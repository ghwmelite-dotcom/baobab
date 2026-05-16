use std::collections::HashSet;
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

const EASYLIST_URL: &str = "https://easylist.to/easylist/easylist.txt";
const EASYPRIVACY_URL: &str = "https://easylist.to/easylist/easyprivacy.txt";

/// Parse an EasyList-formatted text and return the plain `||hostname^` hostnames.
/// Skip path-suffixed rules (e.g. `||sub.example.com/path/*`) which need URL-pattern
/// matching that v1 doesn't support.
pub fn extract_hostnames_from_easylist(text: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('!') || line.starts_with('[') {
            continue;
        }
        let Some(rest) = line.strip_prefix("||") else { continue; };
        // Stop at ^ (which marks end-of-host), or fail if we see / or * first
        let mut host = String::new();
        for c in rest.chars() {
            match c {
                '^' => break,
                '/' | '*' => { host.clear(); break; }
                _ => host.push(c),
            }
        }
        if host.is_empty() { continue; }
        if seen.insert(host.clone()) {
            out.push(host);
        }
    }
    out
}

/// Fetch EasyList + EasyPrivacy from upstream, parse, write the new payload
/// to `$APP_DATA/baobab/adblock/payload.json`, and return it.
pub async fn refresh_from_upstream(app_data_root: &Path) -> Result<AdblockPayload, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let easylist = client
        .get(EASYLIST_URL)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("easylist fetch: {e}"))?
        .text()
        .await
        .map_err(|e| format!("easylist text: {e}"))?;

    let easyprivacy = client
        .get(EASYPRIVACY_URL)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| format!("easyprivacy fetch: {e}"))?
        .text()
        .await
        .map_err(|e| format!("easyprivacy text: {e}"))?;

    let mut seen: HashSet<String> = HashSet::new();
    let mut all: Vec<String> = Vec::new();
    for src in [&easylist, &easyprivacy] {
        for h in extract_hostnames_from_easylist(src) {
            if seen.insert(h.clone()) {
                all.push(h);
            }
        }
    }
    all.sort();

    let now = chrono::Utc::now().to_rfc3339();
    let payload = AdblockPayload {
        blocked_hostnames: all,
        youtube_scriptlets: BUNDLED_YOUTUBE_JS.to_string(),
        last_updated: now.clone(),
        source: AdblockSource::Upstream { fetched_at: now },
    };

    let cache = cache_path(app_data_root);
    if let Some(parent) = cache.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let bytes = serde_json::to_vec_pretty(&payload).map_err(|e| e.to_string())?;
    std::fs::write(&cache, &bytes).map_err(|e| e.to_string())?;

    Ok(payload)
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

use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdblockState {
    pub enabled: bool,
    pub last_updated: String,
    pub source: AdblockSource,
}

fn app_data_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn profile_enabled_key(profile_id: &str) -> String {
    format!("profile.{profile_id}.adblock.enabled")
}

/// Read the per-profile enabled flag. Defaults to true if unset.
pub fn is_enabled_for_profile(app: &AppHandle, profile_id: &str) -> Result<bool, String> {
    if profile_id == "guest" {
        // Guest sessions never get the blocker.
        return Ok(false);
    }
    let store = app.store("baobab.store.json").map_err(|e| e.to_string())?;
    let key = profile_enabled_key(profile_id);
    let v = store.get(&key);
    Ok(v.and_then(|j| j.as_bool()).unwrap_or(true))
}

fn set_enabled_for_profile(app: &AppHandle, profile_id: &str, enabled: bool) -> Result<(), String> {
    let store = app.store("baobab.store.json").map_err(|e| e.to_string())?;
    let key = profile_enabled_key(profile_id);
    store.set(&key, serde_json::Value::Bool(enabled));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_adblock_get_state(
    app: AppHandle,
    profile_id: String,
) -> Result<AdblockState, String> {
    let root = app_data_root(&app)?;
    let payload = load_payload(&root);
    let enabled = is_enabled_for_profile(&app, &profile_id)?;
    Ok(AdblockState {
        enabled,
        last_updated: payload.last_updated,
        source: payload.source,
    })
}

#[tauri::command]
pub async fn cmd_adblock_set_enabled(
    app: AppHandle,
    profile_id: String,
    enabled: bool,
) -> Result<(), String> {
    set_enabled_for_profile(&app, &profile_id, enabled)
}

#[tauri::command]
pub async fn cmd_adblock_refresh_lists(app: AppHandle) -> Result<AdblockState, String> {
    let root = app_data_root(&app)?;
    let payload = refresh_from_upstream(&root).await?;
    // Return state shape; enabled is per-profile so we leave it as `true` here
    // because the command isn't profile-scoped — the caller will re-read state.
    Ok(AdblockState {
        enabled: true,
        last_updated: payload.last_updated,
        source: payload.source,
    })
}

#[cfg(test)]
mod refresh_tests {
    use super::*;

    #[test]
    fn extract_hostnames_from_easylist_format() {
        // Sample EasyList lines: hostname-block rules look like ||domain.tld^
        // with optional path or modifier suffixes after the ^.
        // We extract the bare hostname.
        let raw = r#"
! Comment line, should skip
||doubleclick.net^
||googleadservices.com^$third-party
||tracker.example.com^
||sub.example.com/path/*
[Adblock Plus 2.0]
||cdn.evil.com^$image
random non-block line
"#;
        let extracted = extract_hostnames_from_easylist(raw);
        assert!(extracted.contains(&"doubleclick.net".to_string()));
        assert!(extracted.contains(&"googleadservices.com".to_string()));
        assert!(extracted.contains(&"tracker.example.com".to_string()));
        assert!(extracted.contains(&"cdn.evil.com".to_string()));
        // Path-suffix rules are NOT plain hostname blocks per spec; skip them.
        assert!(!extracted.contains(&"sub.example.com".to_string()));
    }

    #[test]
    fn extract_handles_empty_input() {
        assert_eq!(extract_hostnames_from_easylist(""), Vec::<String>::new());
    }

    #[test]
    fn extract_dedups() {
        let raw = "||doubleclick.net^\n||doubleclick.net^\n";
        let extracted = extract_hostnames_from_easylist(raw);
        assert_eq!(extracted.iter().filter(|h| h == &"doubleclick.net").count(), 1);
    }
}
