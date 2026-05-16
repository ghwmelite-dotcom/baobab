use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const BUNDLED_HOSTNAMES: &str = include_str!("../resources/adblock/hostnames.txt");
const BUNDLED_ENGINE_JS: &str = include_str!("../resources/adblock/engine.js");
const BUNDLED_YOUTUBE_JS: &str = include_str!("../resources/adblock/youtube.js");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum AdblockSource {
    Bundled,
    Upstream { fetched_at: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AdblockPayload {
    pub blocked_hostnames: Vec<String>,
    pub youtube_scriptlets: String,
    pub last_updated: String,
    pub source: AdblockSource,
}

fn parse_hostnames(text: &str) -> Vec<String> {
    text.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(|l| l.to_string())
        .collect()
}

/// Bundled snapshot constructed at build time. Used as the fallback when
/// no cached upstream payload exists or the cache is corrupted.
fn bundled_payload() -> AdblockPayload {
    AdblockPayload {
        blocked_hostnames: parse_hostnames(BUNDLED_HOSTNAMES),
        youtube_scriptlets: BUNDLED_YOUTUBE_JS.to_string(),
        last_updated: chrono::Utc::now().to_rfc3339(),
        source: AdblockSource::Bundled,
    }
}

fn cache_path(app_data_root: &Path) -> PathBuf {
    app_data_root
        .join("baobab")
        .join("adblock")
        .join("payload.json")
}

/// Read the payload from cache if present and parseable; else fall back to bundled.
pub fn load_payload(app_data_root: &Path) -> AdblockPayload {
    let path = cache_path(app_data_root);
    if !path.exists() {
        return bundled_payload();
    }
    match std::fs::read(&path)
        .ok()
        .and_then(|b| serde_json::from_slice::<AdblockPayload>(&b).ok())
    {
        Some(p) => p,
        None => bundled_payload(),
    }
}

/// Engine.js source bundled with the app. Exposed for testing.
pub fn engine_js() -> &'static str {
    BUNDLED_ENGINE_JS
}

const YT_PLACEHOLDER: &str = "/* BAOBAB_YT_SCRIPTLETS_INJECTED_HERE */";

/// Build the per-tab initialization script. Inlines the payload as a JSON
/// literal assigned to a `BAOBAB_ADBLOCK` global, then runs the engine.
/// The engine's YouTube placeholder is substituted with the bundled
/// scriptlets so they only execute when the host matches.
pub fn build_init_script(payload: &AdblockPayload) -> String {
    // serde_json::to_string never produces output that breaks JS string literals
    // when embedded directly into a JS source — quotes, slashes, etc. are escaped.
    let json = serde_json::to_string(payload).expect("payload serialisable");
    let engine = engine_js().replace(YT_PLACEHOLDER, &payload.youtube_scriptlets);
    format!("var BAOBAB_ADBLOCK = {};\n{}", json, engine)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn bundled_payload_has_hostnames() {
        let p = bundled_payload();
        assert!(!p.blocked_hostnames.is_empty());
        assert_eq!(p.source, AdblockSource::Bundled);
    }

    #[test]
    fn bundled_payload_contains_doubleclick() {
        let p = bundled_payload();
        assert!(p.blocked_hostnames.iter().any(|h| h == "doubleclick.net"));
    }

    #[test]
    fn load_falls_back_to_bundled_when_cache_missing() {
        let dir = tempdir().unwrap();
        let p = load_payload(dir.path());
        assert_eq!(p.source, AdblockSource::Bundled);
    }

    #[test]
    fn load_falls_back_when_cache_corrupted() {
        let dir = tempdir().unwrap();
        let cache = cache_path(dir.path());
        std::fs::create_dir_all(cache.parent().unwrap()).unwrap();
        std::fs::write(&cache, b"{garbage").unwrap();

        let p = load_payload(dir.path());
        assert_eq!(p.source, AdblockSource::Bundled);
    }

    #[test]
    fn load_prefers_cache_when_valid() {
        let dir = tempdir().unwrap();
        let cache = cache_path(dir.path());
        std::fs::create_dir_all(cache.parent().unwrap()).unwrap();

        let custom = AdblockPayload {
            blocked_hostnames: vec!["evil.example".to_string()],
            youtube_scriptlets: "// cached".to_string(),
            last_updated: "2026-05-01T00:00:00Z".to_string(),
            source: AdblockSource::Upstream {
                fetched_at: "2026-05-01T00:00:00Z".to_string(),
            },
        };
        std::fs::write(&cache, serde_json::to_vec(&custom).unwrap()).unwrap();

        let loaded = load_payload(dir.path());
        assert_eq!(loaded, custom);
    }

    #[test]
    fn parse_hostnames_skips_blank_and_comment_lines() {
        let raw = "doubleclick.net\n\n# comment\n  googleads.com  \n";
        let parsed = parse_hostnames(raw);
        assert_eq!(parsed, vec!["doubleclick.net", "googleads.com"]);
    }
}

#[cfg(test)]
mod build_init_tests {
    use super::*;

    fn fixture_payload() -> AdblockPayload {
        AdblockPayload {
            blocked_hostnames: vec!["doubleclick.net".to_string(), "googleads.com".to_string()],
            youtube_scriptlets: "console.log('yt');".to_string(),
            last_updated: "2026-05-16T00:00:00Z".to_string(),
            source: AdblockSource::Bundled,
        }
    }

    #[test]
    fn embeds_payload_as_json_literal() {
        let script = build_init_script(&fixture_payload());
        assert!(script.contains("BAOBAB_ADBLOCK"));
        assert!(script.contains("doubleclick.net"));
        assert!(script.contains("googleads.com"));
    }

    #[test]
    fn substitutes_youtube_scriptlets_into_engine() {
        let script = build_init_script(&fixture_payload());
        // The placeholder /* BAOBAB_YT_SCRIPTLETS_INJECTED_HERE */ in engine.js
        // should be replaced with the actual scriptlet source.
        assert!(script.contains("console.log('yt');"));
        assert!(!script.contains("BAOBAB_YT_SCRIPTLETS_INJECTED_HERE"));
    }

    #[test]
    fn empty_scriptlets_leave_placeholder_replaced_with_empty() {
        let mut p = fixture_payload();
        p.youtube_scriptlets = String::new();
        let script = build_init_script(&p);
        assert!(!script.contains("BAOBAB_YT_SCRIPTLETS_INJECTED_HERE"));
    }

    #[test]
    fn safely_escapes_payload_with_special_chars() {
        // Hostnames containing characters that would need JSON-escaping should
        // round-trip via serde_json without breaking the script.
        let p = AdblockPayload {
            blocked_hostnames: vec!["tracker.example.com/path\"weird".to_string()],
            youtube_scriptlets: String::new(),
            last_updated: "2026-05-16T00:00:00Z".to_string(),
            source: AdblockSource::Bundled,
        };
        let script = build_init_script(&p);
        // Should not crash, should contain escaped form
        assert!(script.contains("tracker.example.com/path"));
        // No raw unescaped quote that would break the JS
        let after_eq = script.split("BAOBAB_ADBLOCK = ").nth(1).unwrap();
        let json_chunk = after_eq.split(';').next().unwrap();
        // Parse it back as JSON to prove it's valid
        let _: serde_json::Value = serde_json::from_str(json_chunk).expect("valid JSON");
    }
}
