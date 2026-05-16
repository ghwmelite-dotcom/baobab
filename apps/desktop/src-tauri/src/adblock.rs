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
