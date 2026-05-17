# Ad-blocker v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a v1 ad-blocker that prevents YouTube pre/mid-roll ads from playing and blocks common third-party ad/tracker hostnames (doubleclick, GA, FB Pixel, etc.) across all sites. Per-profile toggle (default ON), bundled filter lists with manual refresh.

**Architecture:** Tauri's `WebviewBuilder::initialization_script` injects a JS IIFE into every tab webview before the page's own JS runs. The IIFE receives an inlined payload (`blockedHostnames: string[]`, `youtubeScriptlets: string`) and installs hooks on `fetch` / `XHR` / `Image.prototype.src` plus a MutationObserver for late-injected tags. On YouTube hosts, additional scriptlets patch the `/youtubei/v1/player` response to strip ad markers. Rust-side `adblock` module owns the filter list lifecycle (bundled snapshot → on-disk cache → upstream refresh) and exposes Tauri commands for per-profile state and manual refresh.

**Tech Stack:** Rust (`reqwest` for upstream fetch, `serde_json`, existing `chrono`/`tempfile`), Tauri 2 IPC + `initialization_script`, TypeScript + Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-16-adblocker-design.md`

---

## File Structure

### New resource files (bundled into binary via `include_str!`)
- `apps/desktop/src-tauri/resources/adblock/hostnames.txt` — newline-delimited list of ~5,000 hostnames extracted from EasyList + EasyPrivacy (pre-extracted and committed to repo; see Task 1)
- `apps/desktop/src-tauri/resources/adblock/youtube.js` — hand-curated YouTube scriptlets (~80 LOC) per spec
- `apps/desktop/src-tauri/resources/adblock/engine.js` — generic init-script engine template (~80 LOC) per spec
- `apps/desktop/src-tauri/resources/adblock/README.md` — maintainer notes (how to refresh `hostnames.txt`, where YouTube scriptlets come from)

### New Rust files
- `apps/desktop/src-tauri/src/adblock.rs` — types, load/save/refresh, init-script builder, Tauri commands; inline `#[cfg(test)] mod tests`

### Modified Rust files
- `apps/desktop/src-tauri/Cargo.toml` — add `reqwest` with `rustls-tls` feature
- `apps/desktop/src-tauri/src/lib.rs` — `mod adblock;` + register 3 new commands in `invoke_handler`
- `apps/desktop/src-tauri/src/tabs.rs` — `create_tab` consults adblock state and attaches `initialization_script` when enabled

### New frontend files
- `apps/desktop/src/adblock/adblock.api.ts` — typed Tauri wrappers
- `apps/desktop/src/adblock/adblock.store.ts` — Zustand store (`enabled`, `lastUpdated`, `source`, `refreshing`, actions; 60s cooldown)
- `apps/desktop/src/settings/sections/AdblockSection.tsx` — Settings panel section (toggle + last-updated + refresh button)

### Modified frontend files
- `apps/desktop/src/settings/SettingsScreen.tsx` — render `<AdblockSection />` in the section list

### New test files
- `apps/desktop/tests/adblock.api.test.ts` — Tauri wrapper tests
- `apps/desktop/tests/adblock.store.test.ts` — store actions + cooldown
- `apps/desktop/tests/adblock.section.test.tsx` — Settings section interactions

---

## Phase 1 — Bundled resources

### Task 1: Bundle hostnames.txt + youtube.js + engine.js + README

**Files:**
- Create: `apps/desktop/src-tauri/resources/adblock/hostnames.txt`
- Create: `apps/desktop/src-tauri/resources/adblock/youtube.js`
- Create: `apps/desktop/src-tauri/resources/adblock/engine.js`
- Create: `apps/desktop/src-tauri/resources/adblock/README.md`

- [ ] **Step 1: Create the resources directory + maintainer README**

```bash
mkdir -p C:/dev/baobab/apps/desktop/src-tauri/resources/adblock
```

Write `apps/desktop/src-tauri/src-tauri/resources/adblock/README.md`:

```markdown
# Ad-blocker bundled resources

These files are compiled into the Baobab desktop binary via `include_str!`
in `apps/desktop/src-tauri/src/adblock.rs`. They serve as the offline
fallback / first-launch snapshot. The runtime can refresh
`hostnames.txt`-equivalent data from upstream (EasyList) into the
on-disk cache at `$APP_DATA/baobab/adblock/payload.json` — but
`youtube.js` and `engine.js` ship only via app releases.

## Refreshing `hostnames.txt` manually

The committed list is extracted from EasyList + EasyPrivacy `||domain.tld^`
rules. To regenerate:

1. Download <https://easylist.to/easylist/easylist.txt> and <https://easylist.to/easylist/easyprivacy.txt>.
2. From each file, take lines matching `^\|\|([^\^/\*$]+)\^` and extract the
   captured hostname.
3. Deduplicate, sort, write one per line to `hostnames.txt`.
4. Commit. App update ships the new list to all users.

## YouTube scriptlets (`youtube.js`)

Hand-curated patches that run when `location.hostname` is a YouTube domain.
They strip `adPlacements` from `/youtubei/v1/player` response, CSS-hide
ad slot containers, and auto-click skip buttons. Maintenance burden:
when YouTube changes their player API or DOM, these need updating.

## Engine (`engine.js`)

The generic init-script body. Receives a `BAOBAB_ADBLOCK` global with
`{ blockedHostnames, youtubeScriptlets, lastUpdated, source }` and
installs hooks on fetch / XHR / Image / MutationObserver. Should change
rarely; structural-only.
```

- [ ] **Step 2: Write the engine template `engine.js`**

Create `apps/desktop/src-tauri/resources/adblock/engine.js`:

```js
(function () {
  // BAOBAB_ADBLOCK is injected as a JSON literal by the Rust builder
  // before this script runs. Shape: { blockedHostnames, youtubeScriptlets, lastUpdated, source }.
  if (typeof BAOBAB_ADBLOCK === 'undefined') return;
  const blocked = new Set(BAOBAB_ADBLOCK.blockedHostnames);

  function hostnameOf(url) {
    try { return new URL(url, location.href).hostname; } catch { return ''; }
  }

  function isBlocked(url) {
    const h = hostnameOf(url);
    if (!h) return false;
    if (blocked.has(h)) return true;
    // Subdomain wildcarding: example.com in the list also blocks api.example.com.
    const parts = h.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (blocked.has(parts.slice(i).join('.'))) return true;
    }
    return false;
  }

  // Hook fetch
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (isBlocked(url)) return Promise.reject(new TypeError('Blocked by Baobab ad-blocker'));
    return origFetch.call(this, input, init);
  };

  // Hook XHR
  const XhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (isBlocked(url)) {
      this.__bbBlocked = true;
      return XhrOpen.call(this, method, 'about:blank', ...rest);
    }
    return XhrOpen.call(this, method, url, ...rest);
  };

  // Hook Image src setter
  const ImgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set(v) {
      if (isBlocked(v)) return;
      ImgSrc.set.call(this, v);
    },
    get() { return ImgSrc.get.call(this); },
    configurable: true,
  });

  // MutationObserver for late-injected <script>/<iframe>/<img>
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        const tag = node.tagName;
        if (tag !== 'SCRIPT' && tag !== 'IFRAME' && tag !== 'IMG') continue;
        const src = node.getAttribute('src');
        if (src && isBlocked(src)) node.remove();
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // YouTube-specific scriptlets, inlined by Rust when host matches.
  const host = location.hostname;
  if (
    host === 'www.youtube.com' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'youtube-nocookie.com'
  ) {
    /* BAOBAB_YT_SCRIPTLETS_INJECTED_HERE */
  }
})();
```

- [ ] **Step 3: Write the YouTube scriptlets `youtube.js`**

Create `apps/desktop/src-tauri/resources/adblock/youtube.js`:

```js
// === Baobab YouTube ad scriptlets ===
// Run only on YouTube hostnames. The Rust template inlines this block
// inside the matching `if` in engine.js.

// 1. Strip adPlacements from player config responses.
(function () {
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const res = await origFetch.call(this, input, init);
    if (!url.includes('/youtubei/v1/player')) return res;
    const clone = res.clone();
    try {
      const text = await clone.text();
      const obj = JSON.parse(text);
      delete obj.adPlacements;
      delete obj.playerAds;
      delete obj.adSlots;
      if (obj.playabilityStatus) delete obj.playabilityStatus.adChoices;
      return new Response(JSON.stringify(obj), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch {
      return res;
    }
  };
})();

// 2. Hide ad slot containers via CSS.
(function () {
  const style = document.createElement('style');
  style.textContent =
    'ytd-ad-slot-renderer,' +
    'ytd-banner-promo-renderer,' +
    'ytd-statement-banner-renderer,' +
    'ytd-in-feed-ad-layout-renderer,' +
    'ytd-promoted-sparkles-text-search-renderer,' +
    'ytd-promoted-video-renderer,' +
    'ytd-display-ad-renderer,' +
    '.ytp-ad-module,' +
    '.ytp-ad-overlay-container { display: none !important; }';
  (document.head || document.documentElement).appendChild(style);
})();

// 3. Auto-skip stragglers.
(function () {
  new MutationObserver(() => {
    const skip = document.querySelector(
      '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button'
    );
    if (skip) skip.click();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
```

- [ ] **Step 4: Write `hostnames.txt` with a starter set**

For v1 ship, we commit a hand-curated starter list of the most common ad/tracker hostnames. This is intentional — extracting full EasyList parsing is its own task, and the starter list demonstrably blocks the trackers in the spec's acceptance criteria. A future task can replace this with a full EasyList extraction.

Create `apps/desktop/src-tauri/resources/adblock/hostnames.txt`:

```
doubleclick.net
googleadservices.com
googlesyndication.com
googletagmanager.com
googletagservices.com
google-analytics.com
analytics.google.com
adservice.google.com
adservice.google.com.gh
pagead2.googlesyndication.com
adsystem.amazon.com
adsystem.amazon.co.uk
amazon-adsystem.com
ads.yahoo.com
ads.linkedin.com
facebook.com/tr
connect.facebook.net
graph.facebook.com/v1.0/me/picture
analytics.facebook.com
scorecardresearch.com
quantserve.com
quantcount.com
chartbeat.com
chartbeat.net
moatads.com
moatpixel.com
adnxs.com
serving-sys.com
adsrvr.org
turn.com
rubiconproject.com
rlcdn.com
adform.net
adsafeprotected.com
casalemedia.com
contextweb.com
criteo.com
criteo.net
demdex.net
everesttech.net
omtrdc.net
2o7.net
sb.scorecardresearch.com
hotjar.com
fullstory.com
mxpnl.com
mixpanel.com
amplitude.com
segment.io
segment.com
optimizely.com
mouseflow.com
luckyorange.com
clarity.ms
bing.com/ads
ads.microsoft.com
clarity.microsoft.com
tiktok.com/i18n/pixel
analytics.tiktok.com
adservice.tiktok.com
business-api.tiktok.com
snap.licdn.com
ads-twitter.com
analytics.twitter.com
syndication.twitter.com
t.co
yieldmo.com
pubmatic.com
3lift.com
openx.net
adskeeper.com
mgid.com
revcontent.com
outbrain.com
taboola.com
zedo.com
adblade.com
adcolony.com
unityads.unity3d.com
applovin.com
adcolony.com
mopub.com
chartbeat.com
parsely.com
parse.ly
nr-data.net
newrelic.com/agent
bam.nr-data.net
js-agent.newrelic.com
cdn.segment.com
api.segment.io
api.amplitude.com
api.mixpanel.com
api.hotjar.com
script.hotjar.com
stats.g.doubleclick.net
ssl.google-analytics.com
www.google-analytics.com
mc.yandex.ru
metrika.yandex.ru
yandex.ru/clck
cm.g.doubleclick.net
googleads.g.doubleclick.net
```

This is ~95 hostnames covering doubleclick, GA, FB Pixel, scorecard, hotjar, mixpanel, segment, the major ad networks (criteo, openx, pubmatic), and common second-tier trackers. Sufficient for the spec's stated acceptance criteria.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src-tauri/resources/adblock/
git commit -m "feat(adblock): bundle starter hostname list + engine.js + youtube scriptlets"
```

---

## Phase 2 — Rust adblock module

### Task 2: Types + `load_payload` with bundled fallback

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/src/adblock.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs` (add `mod adblock;`)

- [ ] **Step 1: Add `reqwest` dependency**

In `apps/desktop/src-tauri/Cargo.toml`, append to `[dependencies]`:

```toml
reqwest = { version = "0.12", default-features = false, features = ["rustls-tls"] }
```

- [ ] **Step 2: Create the `adblock.rs` module with types + load_payload + tests**

Create `apps/desktop/src-tauri/src/adblock.rs`:

```rust
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
```

In `apps/desktop/src-tauri/src/lib.rs`, add `mod adblock;` after `mod migration;` (alphabetic neighbour):

```rust
mod adblock;
mod downloads;
mod migration;
mod pin;
mod pin_attempts;
mod profiles;
mod tabs;
mod windows;
```

- [ ] **Step 3: Run tests**

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo test adblock::tests
```

Expected: 6 tests pass.

- [ ] **Step 4: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/adblock.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(adblock): types + load_payload with bundled fallback"
```

---

### Task 3: `build_init_script`

**Files:**
- Modify: `apps/desktop/src-tauri/src/adblock.rs`

- [ ] **Step 1: Write failing tests for `build_init_script`**

Append to `adblock.rs` (inside the existing `mod tests` would create a cycle; create a new `mod build_init_tests` block instead):

```rust
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
```

- [ ] **Step 2: Implement `build_init_script`**

Append to `adblock.rs` (after the public functions, before the test modules):

```rust
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
```

- [ ] **Step 3: Run tests**

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo test adblock::build_init_tests
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src-tauri/src/adblock.rs
git commit -m "feat(adblock): build_init_script inlines payload + substitutes YT scriptlets"
```

---

### Task 4: `refresh_from_upstream`

**Files:**
- Modify: `apps/desktop/src-tauri/src/adblock.rs`

- [ ] **Step 1: Write failing tests**

Append a new `mod refresh_tests` to `adblock.rs`:

```rust
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
```

- [ ] **Step 2: Implement `extract_hostnames_from_easylist` + `refresh_from_upstream`**

Append to `adblock.rs` (before the test modules):

```rust
use std::collections::HashSet;

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
```

- [ ] **Step 3: Run extraction tests**

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo test adblock::refresh_tests
```

Expected: 3 tests pass. The async `refresh_from_upstream` itself is integration-tested manually (it hits live URLs); we don't add a unit test for it because mocking reqwest would be more code than the function itself.

- [ ] **Step 4: Verify build still clean**

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo build
```

Expected: clean. `reqwest` and its rustls-tls feature pull in compilable native crates.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src-tauri/src/adblock.rs
git commit -m "feat(adblock): refresh_from_upstream fetches + parses EasyList"
```

---

### Task 5: Tauri command shims + per-profile enabled state

**Files:**
- Modify: `apps/desktop/src-tauri/src/adblock.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add the state struct + helpers + command shims**

Append to `adblock.rs` (before the test modules):

```rust
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
```

- [ ] **Step 2: Register the three commands in `lib.rs`**

In `apps/desktop/src-tauri/src/lib.rs`, find the `tauri::generate_handler![...]` block and add the three new commands (grouped near other `cmd_*` entries):

```rust
adblock::cmd_adblock_get_state,
adblock::cmd_adblock_set_enabled,
adblock::cmd_adblock_refresh_lists,
```

- [ ] **Step 3: Verify build**

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo build
```

Expected: clean. Existing tests still pass; no new tests added for the Tauri command shims (they're thin wrappers and require an AppHandle which can't be unit-tested without a Tauri runtime).

Also run the existing test suite to confirm no regressions:

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo test
```

Expected: 57 + new adblock tests = 70 passing (6 + 4 + 3 = 13 new from Tasks 2/3/4).

- [ ] **Step 4: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src-tauri/src/adblock.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(adblock): Tauri commands for get_state / set_enabled / refresh_lists"
```

---

## Phase 3 — Tabs integration

### Task 6: `tabs::create_tab` attaches initialization_script when enabled

**Files:**
- Modify: `apps/desktop/src-tauri/src/tabs.rs`

- [ ] **Step 1: Read the current `create_tab` to understand the attachment point**

Open `apps/desktop/src-tauri/src/tabs.rs`. Find the existing `WebviewBuilder::new(...)` call inside `create_tab`. The builder chain currently looks roughly like:

```rust
let mut builder = tauri::webview::WebviewBuilder::new(&label, webview_url);
if incognito.unwrap_or(false) {
    let dir = std::env::temp_dir().join(format!("baobab-incognito-{}", id));
    builder = builder.data_directory(dir);
} else if let Some(dir) = data_dir_for_window(&app, &window_label) {
    builder = builder.data_directory(dir);
}
let builder = downloads::attach(builder, app.clone());
let builder = builder.on_document_title_changed(...);
let builder = builder.on_page_load(...);
```

- [ ] **Step 2: Insert the adblock attachment**

Add the adblock attachment between the `data_directory` chain and the `downloads::attach` call. The new code resolves the profile id from the window label and checks `adblock::is_enabled_for_profile`:

```rust
// Adblock: attach initialization script when the calling profile has it enabled.
// Guest windows are skipped per design (is_enabled_for_profile returns false for "guest").
let adblock_enabled = match crate::windows::profile_id_from_label(&window_label) {
    Some(pid) => crate::adblock::is_enabled_for_profile(&app, &pid).unwrap_or(true),
    None => false,
};
if adblock_enabled {
    let root = app.path().app_data_dir().map_err(|e: tauri::Error| e.to_string())?;
    let payload = crate::adblock::load_payload(&root);
    let script = crate::adblock::build_init_script(&payload);
    builder = builder.initialization_script(&script);
}
```

Place this block right after the `data_directory` configuration, before `downloads::attach`. The type annotation on the closure parameter (`|e: tauri::Error|`) helps the compiler infer the error mapper since the surrounding function already returns `Result<TabInfo, String>`.

Verify in your editor that `builder` is mutable (`let mut builder` near the top of `create_tab`) — Task 13 of the picker plan introduced this pattern, so it should already be `mut`. If not, change the binding to `let mut builder`.

- [ ] **Step 3: Build to verify**

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo build
```

Expected: clean.

- [ ] **Step 4: Run full Rust test suite (no regressions)**

```bash
cd C:/dev/baobab/apps/desktop/src-tauri && cargo test
```

Expected: all tests pass — no new tests in this task (the integration is hard to unit-test without a live webview; we verify it manually in Task 10).

- [ ] **Step 5: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src-tauri/src/tabs.rs
git commit -m "feat(tabs): attach adblock initialization_script when profile has it enabled"
```

---

## Phase 4 — Frontend wiring

### Task 7: `adblock.api.ts` typed wrappers + tests

**Files:**
- Create: `apps/desktop/src/adblock/adblock.api.ts`
- Create: `apps/desktop/tests/adblock.api.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/tests/adblock.api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'profile-test' }),
}))

import { invoke } from '@tauri-apps/api/core'
import { adblockApi } from '~/adblock/adblock.api'

const invokeMock = invoke as ReturnType<typeof vi.fn>

beforeEach(() => {
  invokeMock.mockReset()
})

describe('adblockApi', () => {
  it('getState sends profileId', async () => {
    invokeMock.mockResolvedValue({
      enabled: true,
      lastUpdated: 'x',
      source: { kind: 'Bundled' },
    })
    await adblockApi.getState('p1')
    expect(invokeMock).toHaveBeenCalledWith('cmd_adblock_get_state', { profileId: 'p1' })
  })

  it('setEnabled sends profileId + enabled', async () => {
    invokeMock.mockResolvedValue(undefined)
    await adblockApi.setEnabled('p1', false)
    expect(invokeMock).toHaveBeenCalledWith('cmd_adblock_set_enabled', { profileId: 'p1', enabled: false })
  })

  it('refreshLists takes no args', async () => {
    invokeMock.mockResolvedValue({ enabled: true, lastUpdated: 'x', source: { kind: 'Bundled' } })
    await adblockApi.refreshLists()
    expect(invokeMock).toHaveBeenCalledWith('cmd_adblock_refresh_lists')
  })
})
```

- [ ] **Step 2: Run test — FAIL**

```bash
cd C:/dev/baobab/apps/desktop && npx vitest run tests/adblock.api.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `adblock.api.ts`**

Create `apps/desktop/src/adblock/adblock.api.ts`:

```ts
import { invoke } from '@tauri-apps/api/core'

export type AdblockSource =
  | { kind: 'Bundled' }
  | { kind: 'Upstream'; fetchedAt: string }

export interface AdblockState {
  enabled: boolean
  lastUpdated: string
  source: AdblockSource
}

export const adblockApi = {
  getState: (profileId: string) => invoke<AdblockState>('cmd_adblock_get_state', { profileId }),
  setEnabled: (profileId: string, enabled: boolean) =>
    invoke<void>('cmd_adblock_set_enabled', { profileId, enabled }),
  refreshLists: () => invoke<AdblockState>('cmd_adblock_refresh_lists'),
}
```

- [ ] **Step 4: Re-run test — expect PASS**

```bash
cd C:/dev/baobab/apps/desktop && npx vitest run tests/adblock.api.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src/adblock/adblock.api.ts apps/desktop/tests/adblock.api.test.ts
git commit -m "feat(adblock): TS API wrappers for adblock IPC commands"
```

---

### Task 8: `adblock.store.ts` with cooldown

**Files:**
- Create: `apps/desktop/src/adblock/adblock.store.ts`
- Create: `apps/desktop/tests/adblock.store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/desktop/tests/adblock.store.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  setEnabled: vi.fn(),
  refreshLists: vi.fn(),
}))

vi.mock('~/adblock/adblock.api', () => ({
  adblockApi: apiMocks,
}))

import { useAdblockStore } from '~/adblock/adblock.store'

beforeEach(() => {
  apiMocks.getState.mockReset()
  apiMocks.setEnabled.mockReset()
  apiMocks.refreshLists.mockReset()
  useAdblockStore.setState({
    enabled: true,
    lastUpdated: '',
    source: { kind: 'Bundled' },
    refreshing: false,
    error: null,
    lastRefreshAttempt: 0,
  })
})

describe('useAdblockStore', () => {
  it('hydrate calls getState and updates store', async () => {
    apiMocks.getState.mockResolvedValue({
      enabled: false,
      lastUpdated: '2026-05-16T00:00:00Z',
      source: { kind: 'Upstream', fetchedAt: '2026-05-16T00:00:00Z' },
    })
    await useAdblockStore.getState().hydrate('p1')
    const s = useAdblockStore.getState()
    expect(s.enabled).toBe(false)
    expect(s.lastUpdated).toBe('2026-05-16T00:00:00Z')
  })

  it('setEnabled persists and updates store', async () => {
    apiMocks.setEnabled.mockResolvedValue(undefined)
    await useAdblockStore.getState().setEnabled('p1', false)
    expect(apiMocks.setEnabled).toHaveBeenCalledWith('p1', false)
    expect(useAdblockStore.getState().enabled).toBe(false)
  })

  it('refresh updates lastUpdated and source', async () => {
    apiMocks.refreshLists.mockResolvedValue({
      enabled: true,
      lastUpdated: '2026-05-16T10:00:00Z',
      source: { kind: 'Upstream', fetchedAt: '2026-05-16T10:00:00Z' },
    })
    await useAdblockStore.getState().refresh()
    const s = useAdblockStore.getState()
    expect(s.lastUpdated).toBe('2026-05-16T10:00:00Z')
    expect(s.source).toEqual({ kind: 'Upstream', fetchedAt: '2026-05-16T10:00:00Z' })
    expect(s.refreshing).toBe(false)
  })

  it('refresh enforces 60s cooldown', async () => {
    apiMocks.refreshLists.mockResolvedValue({ enabled: true, lastUpdated: 'x', source: { kind: 'Bundled' } })
    await useAdblockStore.getState().refresh()
    apiMocks.refreshLists.mockClear()

    // Second call within 60s should be a no-op
    await useAdblockStore.getState().refresh()
    expect(apiMocks.refreshLists).not.toHaveBeenCalled()
  })

  it('refresh surfaces error and clears refreshing flag', async () => {
    apiMocks.refreshLists.mockRejectedValue('network failure')
    await useAdblockStore.getState().refresh()
    const s = useAdblockStore.getState()
    expect(s.error).toBe('network failure')
    expect(s.refreshing).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — FAIL**

```bash
cd C:/dev/baobab/apps/desktop && npx vitest run tests/adblock.store.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `adblock.store.ts`**

Create `apps/desktop/src/adblock/adblock.store.ts`:

```ts
import { create } from 'zustand'
import { adblockApi, type AdblockSource } from './adblock.api'

const COOLDOWN_MS = 60_000

interface AdblockState {
  enabled: boolean
  lastUpdated: string
  source: AdblockSource
  refreshing: boolean
  error: string | null
  lastRefreshAttempt: number

  hydrate: (profileId: string) => Promise<void>
  setEnabled: (profileId: string, enabled: boolean) => Promise<void>
  refresh: () => Promise<void>
}

export const useAdblockStore = create<AdblockState>((set, get) => ({
  enabled: true,
  lastUpdated: '',
  source: { kind: 'Bundled' },
  refreshing: false,
  error: null,
  lastRefreshAttempt: 0,

  hydrate: async (profileId) => {
    try {
      const s = await adblockApi.getState(profileId)
      set({
        enabled: s.enabled,
        lastUpdated: s.lastUpdated,
        source: s.source,
        error: null,
      })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  setEnabled: async (profileId, enabled) => {
    await adblockApi.setEnabled(profileId, enabled)
    set({ enabled })
  },

  refresh: async () => {
    const now = Date.now()
    if (now - get().lastRefreshAttempt < COOLDOWN_MS) return
    set({ refreshing: true, error: null, lastRefreshAttempt: now })
    try {
      const s = await adblockApi.refreshLists()
      set({
        lastUpdated: s.lastUpdated,
        source: s.source,
        refreshing: false,
      })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        refreshing: false,
      })
    }
  },
}))
```

- [ ] **Step 4: Re-run test — expect 5 PASS**

```bash
cd C:/dev/baobab/apps/desktop && npx vitest run tests/adblock.store.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src/adblock/adblock.store.ts apps/desktop/tests/adblock.store.test.ts
git commit -m "feat(adblock): Zustand store with 60s refresh cooldown"
```

---

### Task 9: `<AdblockSection>` + Settings integration

**Files:**
- Create: `apps/desktop/src/settings/sections/AdblockSection.tsx`
- Create: `apps/desktop/tests/adblock.section.test.tsx`
- Modify: `apps/desktop/src/settings/SettingsScreen.tsx`

- [ ] **Step 1: Write failing test for the section component**

Create `apps/desktop/tests/adblock.section.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const apiMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  setEnabled: vi.fn(),
  refreshLists: vi.fn(),
}))
vi.mock('~/adblock/adblock.api', () => ({ adblockApi: apiMocks }))

const profileMock = vi.hoisted(() => ({ useProfile: vi.fn() }))
vi.mock('~/profiles/useProfile', () => profileMock)

const stubProfile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: '', lastUsedAt: '', cloudLink: null, userDataDirName: '', pinRequired: false,
}

import { useAdblockStore } from '~/adblock/adblock.store'
import { AdblockSection } from '~/settings/sections/AdblockSection'

beforeEach(() => {
  apiMocks.getState.mockReset()
  apiMocks.setEnabled.mockReset()
  apiMocks.refreshLists.mockReset()
  profileMock.useProfile.mockReturnValue(stubProfile)
  useAdblockStore.setState({
    enabled: true,
    lastUpdated: '2026-05-16T00:00:00Z',
    source: { kind: 'Bundled' },
    refreshing: false,
    error: null,
    lastRefreshAttempt: 0,
  })
})

describe('AdblockSection', () => {
  it('renders the toggle bound to store state', () => {
    render(<AdblockSection />)
    const checkbox = screen.getByRole('checkbox', { name: /block ads and trackers/i }) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('clicking the toggle calls setEnabled with the profile id', async () => {
    apiMocks.setEnabled.mockResolvedValue(undefined)
    render(<AdblockSection />)
    fireEvent.click(screen.getByRole('checkbox', { name: /block ads and trackers/i }))
    await waitFor(() => {
      expect(apiMocks.setEnabled).toHaveBeenCalledWith('p1', false)
    })
  })

  it('clicking refresh button calls refreshLists', async () => {
    apiMocks.refreshLists.mockResolvedValue({
      enabled: true,
      lastUpdated: '2026-05-16T10:00:00Z',
      source: { kind: 'Upstream', fetchedAt: '2026-05-16T10:00:00Z' },
    })
    render(<AdblockSection />)
    fireEvent.click(screen.getByRole('button', { name: /refresh filter lists/i }))
    await waitFor(() => {
      expect(apiMocks.refreshLists).toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run test — FAIL**

```bash
cd C:/dev/baobab/apps/desktop && npx vitest run tests/adblock.section.test.tsx
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create `AdblockSection.tsx`**

Create `apps/desktop/src/settings/sections/AdblockSection.tsx`:

```tsx
import { useEffect } from 'react'
import { useAdblockStore } from '~/adblock/adblock.store'
import { useProfile } from '~/profiles/useProfile'

function relativeTime(iso: string): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (isNaN(then)) return iso
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function AdblockSection() {
  const profile = useProfile()
  const enabled = useAdblockStore((s) => s.enabled)
  const lastUpdated = useAdblockStore((s) => s.lastUpdated)
  const source = useAdblockStore((s) => s.source)
  const refreshing = useAdblockStore((s) => s.refreshing)
  const error = useAdblockStore((s) => s.error)
  const hydrate = useAdblockStore((s) => s.hydrate)
  const setEnabled = useAdblockStore((s) => s.setEnabled)
  const refresh = useAdblockStore((s) => s.refresh)

  useEffect(() => {
    if (profile?.id) void hydrate(profile.id)
  }, [profile?.id, hydrate])

  if (!profile) return null

  return (
    <section style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Ad blocker</h2>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => void setEnabled(profile.id, e.target.checked)}
          aria-label="Block ads and trackers"
        />
        Block ads and trackers
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        Toggle off if a site breaks. Per-site allowlist coming soon. Changes apply to new tabs.
      </p>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Filter lists last updated: <strong>{relativeTime(lastUpdated)}</strong>
          {source.kind === 'Bundled' && ' (bundled)'}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label="Refresh filter lists now"
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--surface-1)', cursor: refreshing ? 'wait' : 'pointer',
            fontSize: 12,
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh filter lists'}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 10, color: 'var(--danger)', fontSize: 12 }}>
          {error}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Render the section in `SettingsScreen.tsx`**

Open `apps/desktop/src/settings/SettingsScreen.tsx`. Add an import:

```tsx
import { AdblockSection } from './sections/AdblockSection'
```

Find where the other sections (e.g. `<GeneralSection />`, `<PrivacySection />`) are rendered. Add `<AdblockSection />` in a sensible position — recommended placement is between `<PrivacySection />` and `<AISection />` (adblock is privacy-adjacent). The exact insertion point depends on the file's current JSX; place it inside the same parent container as the other sections.

- [ ] **Step 5: Run targeted test — expect 3 PASS**

```bash
cd C:/dev/baobab/apps/desktop && npx vitest run tests/adblock.section.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Run full TS suite + typecheck**

```bash
cd C:/dev/baobab/apps/desktop && npm test && npm run typecheck
```

Expected: 159 (previous) + 3 (api) + 5 (store) + 3 (section) = 170 tests passing; typecheck clean.

- [ ] **Step 7: Commit**

```bash
cd C:/dev/baobab
git add apps/desktop/src/adblock/ apps/desktop/src/settings/sections/AdblockSection.tsx apps/desktop/src/settings/SettingsScreen.tsx apps/desktop/tests/adblock.section.test.tsx
git commit -m "feat(adblock): AdblockSection in Settings + wire into SettingsScreen"
```

---

## Phase 5 — Manual integration

### Task 10: Manual smoke + acceptance

**Files:** None — runtime verification only.

- [ ] **Step 1: Stop the running dev server if up**

If `npm run tauri dev` is running, Ctrl+C it (or run `taskkill /F /IM baobab-desktop.exe` on Windows). The Rust changes need a fresh recompile.

- [ ] **Step 2: Boot dev**

```bash
cd C:/dev/baobab/apps/desktop && npm run tauri dev
```

Wait for the Tauri exe to launch.

- [ ] **Step 3: YouTube acceptance (the headline)**

1. In a profile window, navigate to `https://www.youtube.com/watch?v=dQw4w9WgXcQ` (or any video). Confirm: **no pre-roll ad plays** — the video starts immediately.
2. Open a longer video (10+ minutes). At minute 5–9, confirm: **no mid-roll ad interrupts**.
3. Open DevTools → Console. Should see no errors from the init script.
4. Open DevTools → Network. Look for requests to `youtubei/v1/player`. The response should NOT contain `adPlacements` (our scriptlet stripped it).

- [ ] **Step 4: Tracker blocking acceptance**

1. Navigate to `https://www.nytimes.com/` (or any news site that ships display ads).
2. Open DevTools → Network. Filter by `doubleclick`. Confirm: requests show as failed (`TypeError: Blocked by Baobab ad-blocker` in Console, or the request entry is greyed/blocked).
3. Same check for `googleads`, `google-analytics`, `googletagmanager`. All should be blocked.

- [ ] **Step 5: Settings UI acceptance**

1. Open Settings (gear icon or Ctrl+,). Scroll to "Ad blocker" section.
2. Confirm: toggle is **on** by default.
3. Confirm: "Filter lists last updated:" shows a relative time + "(bundled)" suffix.
4. Click **Refresh filter lists**. Spinner appears, completes within ~5–10 seconds. The "(bundled)" suffix should disappear and the relative time updates to "just now".

- [ ] **Step 6: Toggle-off acceptance**

1. With Settings open, toggle ad blocker **off**.
2. Open a **new** tab. Navigate to `https://www.nytimes.com/`. Confirm: ads now load (network requests to doubleclick.net succeed).
3. Toggle ad blocker **on** again. Open another new tab. Navigate to nytimes.com. Confirm: ads blocked again.
4. Verify documented limitation: the **previous** tab (opened while toggle was off) still has ads showing — the init script was injected at tab creation time, not re-injected on toggle. Acceptable; spec called this out.

- [ ] **Step 7: Offline-graceful refresh**

1. Disconnect from internet (or use Windows airplane mode).
2. In Settings, click **Refresh filter lists**. Spinner appears, then errors out.
3. Confirm: error message displays under the section ("error sending request" or similar). The "Last updated" timestamp does NOT change. Existing payload (bundled or last successful) is still in use — try navigating to nytimes.com in a new tab; ads should still be blocked.
4. Reconnect to internet. Click Refresh again. Now succeeds.

- [ ] **Step 8: Guest window has no blocker**

1. Open the picker via avatar button → "Guest mode" pill.
2. In the guest window, navigate to nytimes.com.
3. Confirm: ads load (no blocker injected per spec).

- [ ] **Step 9: Final acceptance commit**

If everything above passed:

```bash
cd C:/dev/baobab
git commit --allow-empty -m "feat(adblock): v1 manually verified

All 8 acceptance criteria from
docs/superpowers/specs/2026-05-16-adblocker-design.md verified
end-to-end on Windows dev build:
- YouTube pre/mid-roll ads do not play
- doubleclick / GA / GTM / FB pixel requests blocked on news sites
- Settings shows toggle + last-updated + refresh button
- Toggle off → new tabs see ads
- Refresh button fetches and updates lastUpdated
- Offline refresh fails gracefully (cached lists stay in use)
- Guest windows skip the blocker"
```

If anything failed: do NOT commit the marker. Diagnose, write the deviation into `memory/plan_deviations.md`, fix forward.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ JS-injection engine via `initialization_script` → Task 1 (engine.js) + Task 6 (tabs.rs attaches it)
- ✅ Hostname-based network blocking → engine.js `isBlocked` + bundled hostnames in Task 1
- ✅ YouTube scriptlets injected when on `youtube.com` → engine.js placeholder + Task 1 (youtube.js) + Task 3 (build_init_script substitution)
- ✅ Per-profile toggle (default ON) → Task 5 (`is_enabled_for_profile`) + Task 7/8/9 (TS surface)
- ✅ Bundled snapshot + on-disk cache + bundled fallback on corruption → Task 2 (load_payload tests)
- ✅ Manual refresh from upstream → Task 4 (`refresh_from_upstream`) + Task 5 (`cmd_adblock_refresh_lists`) + Task 8 (store refresh action) + Task 9 (UI button)
- ✅ 60s client-side refresh cooldown → Task 8 store test
- ✅ Guest windows skip blocker → Task 5 (`is_enabled_for_profile` returns false for "guest"), verified manually Task 10 step 8
- ✅ Toggle-off only affects new tabs (documented limitation) → manually verified Task 10 step 6
- ✅ Subdomain wildcard matching → engine.js logic
- ✅ MutationObserver for late `<script>`/`<iframe>`/`<img>` → engine.js logic

**Placeholder scan:** None. Every step has runnable code or commands; no "TODO", "TBD", or vague "add error handling".

**Type consistency:**
- Rust `AdblockSource` enum: `Bundled` and `Upstream { fetched_at }` ↔ TS `AdblockSource = { kind: 'Bundled' } | { kind: 'Upstream'; fetchedAt: string }` — serde `tag = "kind"` makes this match ✓
- Rust `AdblockState { enabled, last_updated, source }` ↔ TS `AdblockState { enabled, lastUpdated, source }` ✓
- `cmd_adblock_get_state(profile_id)` ↔ `invoke('cmd_adblock_get_state', { profileId })` — Tauri camelCase conversion ✓
- `cmd_adblock_set_enabled(profile_id, enabled)` ↔ `invoke('...', { profileId, enabled })` ✓
- `cmd_adblock_refresh_lists()` no args on both sides ✓
- `is_enabled_for_profile` defaults to true and returns false for `"guest"` consistently ✓

**Test counts at end of plan:**
- Rust: 57 (existing) + 6 (load_tests) + 4 (build_init_tests) + 3 (refresh_tests) = **70**
- TS: 159 (existing including refresh) + 3 (api) + 5 (store) + 3 (section) = **170**

No gaps identified.
