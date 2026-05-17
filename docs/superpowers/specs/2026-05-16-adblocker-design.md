# Ad-blocker v1 — Design

**Status:** draft (awaiting user review)
**Date:** 2026-05-16
**Branch context:** No ad-blocker exists today. WebView2 loads every URL the page requests; YouTube ads play normally. This v1 adds a JS-injection-based blocker that hides YouTube ads and blocks common third-party ad/tracker hostnames.

## Goal

Ship a focused v1 ad-blocker whose headline acceptance criterion is "**YouTube pre-roll and mid-roll ads no longer play.**" As a side benefit, common third-party ad/tracker hostnames (doubleclick.net, googleadservices.com, Google Analytics, Facebook Pixel, scorecardresearch.com, etc.) are blocked at the network layer across all sites.

## Honest threat model & coverage

**What this blocks well:**
- YouTube pre-roll, mid-roll, and post-roll video ads (via scriptlets that strip ad markers from the player config response)
- Third-party ad/tracker requests dispatched by JS after page load (the `fetch` / `XHR` / `Image` / `<script>` / `<iframe>` injection paths)
- Hostnames in EasyList/EasyPrivacy that match by exact domain — covers the noisiest 70–80% of ad traffic

**What this does NOT block (call-outs for honest expectations):**
- **Scripts referenced directly in the initial HTML response.** The browser fetches `<script src="https://doubleclick.net/foo.js">` from the inline HTML before any JS runs — including our hook. Mitigated partially by removing the tag via MutationObserver, but the request may have already left.
- **Native / in-feed ads.** Twitter sponsored tweets, Reddit promoted posts, Facebook in-stream — these are served from the same domain as content and look like real posts. No v1 coverage.
- **URL-pattern-based filters.** EasyList rules like `||example.com/ads/*` only check hostname, not path. So `cdn.example.com/legitimate.js` would also be blocked if `cdn.example.com` is in our list, and `example.com/ads/banner.png` would NOT be blocked unless `example.com` itself is. This is the main 20% coverage gap vs uBlock Origin.
- **Cosmetic filters** (hide-this-CSS-selector rules). No element hiding in v1. Real users will see broken ad-iframe placeholders on some sites instead of the original ad — visually less polished than uBO.
- **Anti-adblock detection.** Some sites detect ad-block and refuse content. No countermeasure in v1.

This is honest. v1 is a "comprehensive YouTube blocker + common-tracker shield" — not a full uBlock Origin replacement.

## Non-goals (deferred to later)

- Cosmetic CSS element hiding (per-domain or generic) — v1.1
- Per-site whitelist / exception list with shield icon UI — v1.1
- Auto-update of filter lists from upstream — v1.1
- URL-pattern matching (regex, path-aware) — v2 (would need adblock-rust WASM)
- "Blocked count" UI / stats — v1.1
- Custom user filter rules — v2
- Anti-adblock-defeat — v2+
- macOS testing — Windows-first as elsewhere

## Key decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Engine model | JS injection via Tauri's `initialization_script` | Tauri 2 + Wry don't expose WebView2's `WebResourceRequested` API. Native network blocking would require forking Wry. JS injection is the realistic v1 path. |
| Filter scope | EasyList + EasyPrivacy hostnames + hand-curated YouTube scriptlets | Hostname matching covers the common case; YouTube needs custom scriptlets either way; cosmetic and URL-pattern filters are explicitly deferred. |
| Bundle vs fetch | Bundle frozen snapshots in v1; manual refresh button | Auto-update is real engineering (network retry, integrity check, version tracking). v1 ships with bundled lists and a manual "Refresh filter lists" Settings button. Auto-update is v1.1. |
| Settings scope | Per-profile master toggle; default ON | Profile-aware like everything else in Baobab. No per-site whitelist in v1 — if a site breaks, user toggles the whole feature off for that profile. |
| Payload delivery | Embedded in the per-tab `initialization_script` as JSON | Avoids needing a custom Tauri protocol or IPC call from the init script (which would race the page load). |
| Scriptlet source | Hand-port 3–5 known-good YouTube scriptlets from uBO Origin's `scriptlets/` directory | Full uBO scriptlet engine is too heavy for v1. We pick the specific ones that handle YouTube. |

## Architecture

### Rust side — new `apps/desktop/src-tauri/src/adblock.rs`

**Bundled resources** (added to repo, compiled into binary via `include_str!`):
- `apps/desktop/src-tauri/resources/adblock/hostnames.txt` — newline-delimited list of blocked hostnames (one per line). Extracted from EasyList + EasyPrivacy's `||domain.tld^` rules using a build-time script (or hand-prepared and committed; see below).
- `apps/desktop/src-tauri/resources/adblock/youtube.js` — hand-curated YouTube scriptlets, ~50 LOC of vanilla JS.
- `apps/desktop/src-tauri/resources/adblock/engine.js` — the generic init-script logic that hooks fetch/XHR/Image/MutationObserver. Receives the payload as a `BAOBAB_ADBLOCK` global injected before it runs.

**Payload struct:**

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdblockPayload {
    pub blocked_hostnames: Vec<String>,
    pub youtube_scriptlets: String,  // raw JS source as a single string
    pub last_updated: String,        // ISO8601 timestamp from when the lists were last refreshed
    pub source: AdblockSource,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AdblockSource {
    Bundled,
    Upstream { fetched_at: String },
}
```

**Storage:**
- Compiled payload cached at `$APP_DATA/baobab/adblock/payload.json` once a successful refresh has occurred
- On launch, prefer cached payload if present and not corrupt; else fall back to bundled snapshot
- Persist `lastUpdated` so Settings UI can show "Filter lists last updated: 3 days ago"

**Rust functions:**

```rust
/// Load current payload (cached or bundled) from disk + memory.
pub fn load_payload(app_data_root: &Path) -> AdblockPayload;

/// Refresh from upstream — fetch easylist.to + easyprivacy + YouTube scriptlet
/// source, recompile, write to disk, return new payload. Manual trigger only in v1.
pub async fn refresh_from_upstream(app_data_root: &Path) -> Result<AdblockPayload, String>;

/// Build the init script JS that gets passed to WebviewBuilder.initialization_script.
/// Format: an IIFE that injects BAOBAB_ADBLOCK payload + engine.js + (if youtube) youtube.js.
pub fn build_init_script(payload: &AdblockPayload) -> String;
```

**Tauri commands:**

```rust
#[tauri::command]
async fn cmd_adblock_get_state(app: AppHandle, profile_id: String) -> Result<AdblockState, String>;
// Returns: { enabled: bool, lastUpdated: string, source: AdblockSource }

#[tauri::command]
async fn cmd_adblock_set_enabled(app: AppHandle, profile_id: String, enabled: bool) -> Result<(), String>;

#[tauri::command]
async fn cmd_adblock_refresh_lists(app: AppHandle) -> Result<AdblockPayload, String>;
// Fires the upstream fetch + recompile. Manually triggered from Settings.
```

### `tabs.rs` integration

`tabs::create_tab` (and the future `tab_navigate` path) determines whether to attach the ad-block init script:

```rust
async fn create_tab(/* ...existing params... */, app: AppHandle, window_label: String, ...) {
    // ...existing setup...

    let profile_id = windows::profile_id_from_label(&window_label);
    let adblock_enabled = match &profile_id {
        Some(id) if id != "guest" => adblock::is_enabled_for_profile(&app, id).unwrap_or(true),
        _ => false,  // guest sessions skip ad-block (avoids leaking state about preferences)
    };

    let mut builder = tauri::webview::WebviewBuilder::new(&label, webview_url);

    if adblock_enabled {
        let payload = adblock::load_payload(&app_data_root);
        let script = adblock::build_init_script(&payload);
        builder = builder.initialization_script(&script);
    }

    // ...rest of existing builder logic, data_directory, etc...
}
```

**Default for new profiles:** `adblock.enabled = true`. The toggle is stored via the existing `profileScoped` persistence wrapper at key `adblock.enabled`.

**Incognito tabs within a profile:** Inherit their parent profile's adblock setting. Incognito's purpose is data-isolation, not preference reset — if a user has adblock on for their profile, they want adblock on for their private browsing too.

**Limitation called out:** Toggle changes only affect NEW navigations / new tab webviews. Already-open tabs keep the script that was injected when they were created. Closing & reopening a tab applies the new setting. v1.1 could send a re-inject IPC.

### Frontend side

**New `apps/desktop/src/adblock/`:**
- `adblock.api.ts` — typed Tauri wrappers (`getState`, `setEnabled`, `refreshLists`)
- `adblock.store.ts` — per-profile Zustand store (`enabled`, `lastUpdated`, `source`, `refreshing`, actions)
- `AdblockSection.tsx` — Settings panel section (toggle + last-updated label + refresh button)

**Settings panel integration:**
- Existing `apps/desktop/src/settings/SettingsScreen.tsx` adds an "Ad blocker" section
- Contents:
  - Toggle: "Block ads and trackers" — bound to `adblockStore.enabled`
  - Static text: "Filter lists last updated: {relative time}" — e.g. "3 hours ago" / "2 days ago"
  - Button: "Refresh filter lists now" — calls `cmd_adblock_refresh_lists`, shows spinner while running
  - Helper text: "Toggle off if a site breaks. Per-site allowlist coming soon."

**No omnibar shield icon in v1.** Explicit choice.

### The init script (`engine.js`)

Embedded structure (Rust formats this on-demand):

```js
(function () {
  const BAOBAB_ADBLOCK = {/* payload JSON inlined here */};
  const blocked = new Set(BAOBAB_ADBLOCK.blockedHostnames);

  function hostnameOf(url) {
    try { return new URL(url, location.href).hostname; } catch { return ''; }
  }

  function isBlocked(url) {
    const h = hostnameOf(url);
    if (!h) return false;
    if (blocked.has(h)) return true;
    // Subdomain wildcarding: example.com in the list blocks api.example.com too.
    const parts = h.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      if (blocked.has(parts.slice(i).join('.'))) return true;
    }
    return false;
  }

  // Hook fetch
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input.url;
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

  // Hook Image
  const ImgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set(v) {
      if (isBlocked(v)) return;
      ImgSrc.set.call(this, v);
    },
    get() { return ImgSrc.get.call(this); },
  });

  // MutationObserver for late <script> / <iframe> / <img> injections that
  // browsers may have already started fetching from the HTML. We can still
  // remove the DOM node, even if the request is in flight.
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

  // YouTube-specific scriptlets (inlined when applicable).
  const host = location.hostname;
  if (host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') {
    // YouTube scriptlet source pasted in here at Rust template time
    {{YOUTUBE_SCRIPTLETS}}
  }
})();
```

The Rust `build_init_script` is responsible for safely escaping the payload JSON and substituting `{{YOUTUBE_SCRIPTLETS}}`.

### YouTube scriptlets (the headline)

`apps/desktop/src-tauri/resources/adblock/youtube.js` contains hand-curated patches that run only on YouTube. Initial set:

```js
// 1. Strip adPlacements from player config responses.
//    YouTube fetches /youtubei/v1/player; the response includes ad markers.
//    We wrap fetch and rewrite the response JSON.
(function () {
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : input.url;
    const res = await origFetch.call(this, input, init);
    if (!url.includes('/youtubei/v1/player')) return res;
    const clone = res.clone();
    const text = await clone.text();
    try {
      const obj = JSON.parse(text);
      delete obj.adPlacements;
      delete obj.playerAds;
      delete obj.adSlots;
      if (obj.playabilityStatus) delete obj.playabilityStatus.adChoices;
      return new Response(JSON.stringify(obj), {
        status: res.status, statusText: res.statusText, headers: res.headers,
      });
    } catch { return res; }
  };
})();

// 2. Hide ad slot containers via CSS (specific selectors, not generic).
const style = document.createElement('style');
style.textContent = `
  ytd-ad-slot-renderer,
  ytd-banner-promo-renderer,
  ytd-statement-banner-renderer,
  ytd-in-feed-ad-layout-renderer,
  ytd-promoted-sparkles-text-search-renderer,
  ytd-promoted-video-renderer,
  ytd-display-ad-renderer,
  .ytp-ad-module,
  .ytp-ad-overlay-container { display: none !important; }
`;
(document.head || document.documentElement).appendChild(style);

// 3. Auto-skip if a skip button appears anyway (defensive — the player
//    config rewriter should prevent ads in the first place, but YouTube
//    occasionally bypasses; this catches stragglers).
new MutationObserver(() => {
  const skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
  if (skip) skip.click();
}).observe(document.documentElement, { childList: true, subtree: true });
```

These are surgical, not generic. They will need maintenance when YouTube changes their player API or DOM structure — that's the medium-term cost of going scriptlet route.

## Data flow

### Page load

```
User navigates a profile-window tab to https://www.youtube.com/watch?v=xyz
  → tabs::create_tab determines profile.adblock.enabled (default true)
  → adblock::load_payload(root) returns the current AdblockPayload
  → adblock::build_init_script(&payload) returns the full IIFE string
  → WebviewBuilder.initialization_script(script)
  → WebView2 loads page; before any page JS runs, the IIFE installs hooks
  → YouTube's player fetch is intercepted; adPlacements is stripped
  → Video plays without pre-roll
```

### Toggle off via Settings

```
User opens Settings → Ad blocker section → unchecks toggle
  → AdblockSection.tsx → adblockStore.setEnabled(false)
  → store action calls cmd_adblock_set_enabled(profileId, false)
  → Rust writes profileScoped("adblock.enabled") = false via plugin-store
  → No effect on currently-open tabs (their init_script already injected)
  → New tabs / next navigations see the new state — no script injected
```

User-visible note (in Settings helper text): "Changes apply to new tabs."

### Manual refresh

```
User clicks "Refresh filter lists now"
  → adblockStore.refresh()
  → cmd_adblock_refresh_lists()
  → Rust: fetch https://easylist.to/easylist/easylist.txt + https://easylist.to/easylist/easyprivacy.txt (the only two upstream sources; YouTube scriptlets ship bundled and update with app releases — see Open Questions #1)
  → On success: extract hostnames, write to $APP_DATA/baobab/adblock/payload.json, update lastUpdated, return new payload
  → On failure: return Err, store keeps showing old lastUpdated, alert user
  → Future tab creations use the new payload
```

## Error handling

- **Bundled snapshot corrupted or missing.** `load_payload` falls back to an empty payload (no blocking) and logs a warning. The app still works; ads just aren't blocked.
- **Cached payload corrupted.** `load_payload` discards it and uses the bundled snapshot.
- **Upstream fetch fails during refresh.** Refresh returns `Err`; cached/bundled payload stays in use. Settings shows the previous `lastUpdated` plus a one-time error toast.
- **YouTube changes their player API.** Our scriptlets stop working silently. Acknowledged maintenance debt; v1.1 monitoring strategy is a separate ask.
- **A site hard-breaks because of the blocker.** No per-site whitelist in v1 — user toggles the master switch off. Acceptable given the deliberate scope.

## Security

- **Init script runs in the page's JS context.** Same-origin to the page. It cannot exfiltrate from cross-origin pages or read Tauri IPC.
- **Payload travels via initialization_script as a JSON literal.** No remote code execution: the engine logic is bundled with the app and never fetched at runtime.
- **Refresh fetch hits public URLs over HTTPS** (`easylist.to`). No auth. Standard cert validation. If easylist.to is ever compromised, an attacker could inject malicious hostnames — but the worst they can do is cause us to *over*-block (block legitimate sites). Read-only attack surface.
- **Profile scope:** Guest windows never get the blocker injected (avoids leaking the user's adblock preference into ephemeral sessions). Documented choice.

## Testing

### Rust unit (`cargo test`)

- `adblock::load_payload` falls back to bundled snapshot when cache missing or corrupt
- `adblock::load_payload` prefers cache when valid and present
- `adblock::build_init_script` produces valid JS containing the payload as a JSON literal (regex check for the `BAOBAB_ADBLOCK = {...}` block)
- `adblock::build_init_script` includes YouTube scriptlets only when payload's `youtubeScriptlets` is non-empty
- `cmd_adblock_set_enabled` writes through `profileScoped` persistence and round-trips via `cmd_adblock_get_state`

### TS unit (`vitest`)

- `adblock.api.ts` wrappers forward to correct Tauri command names
- `adblock.store.ts` `setEnabled` calls IPC + updates state
- `adblock.store.ts` `refresh` calls IPC + updates `lastUpdated`
- `<AdblockSection>` renders toggle bound to store state; clicking calls `setEnabled`

### Manual integration

1. Fresh build → open any profile window → navigate to `https://www.youtube.com/watch?v=anyId`. **No pre-roll ad plays.** Video starts immediately.
2. Open a longer YouTube video (10+ min) where YouTube would normally insert a mid-roll. **No mid-roll ad interruption.**
3. Navigate to `https://www.nytimes.com/`. Open DevTools → Network. **Requests to `doubleclick.net`, `googleadservices.com`, `googletagmanager.com` are blocked** (red-x in the network panel or `TypeError: Blocked by Baobab ad-blocker` errors).
4. Open Settings → Ad blocker. **Toggle is on; "Filter lists last updated" shows the bundled snapshot date.**
5. Toggle off. Open a new tab → navigate to `nytimes.com`. **Ads now load.** Existing tab still has the blocker active (documented limitation).
6. Toggle back on. New tab → nytimes.com. **Ads blocked again.**
7. Click "Refresh filter lists now". **Spinner appears, completes within a few seconds, `lastUpdated` updates to now.**
8. Disconnect internet → click "Refresh filter lists now". **Error toast appears; old lists still work for new navigations.**

### Smoke for failure modes

- Visit a site that detects ad-blockers (e.g., forbes.com). It probably shows an anti-adblock wall. **Document as a known v1 limitation.**
- Verify guest windows never get the blocker (open guest → DevTools → check `window.BAOBAB_ADBLOCK` is undefined).

## Migration

None required. New install: bundled snapshot is used immediately. Existing installs (post picker+PIN): `adblock.enabled` key doesn't exist for any profile yet → `cmd_adblock_get_state` returns `true` (default). First tab navigation triggers script injection.

## Acceptance criteria for v1

- ✅ Navigating to a YouTube video in a profile window plays the video without any pre-roll or mid-roll ad
- ✅ Common third-party tracker requests (doubleclick, GA, FB Pixel, scorecardresearch) are blocked on any site
- ✅ Settings → Ad blocker section shows a per-profile toggle, defaulting ON for new profiles
- ✅ Toggling off causes ads to return on next-navigation (existing tab limitation documented)
- ✅ Manual "Refresh filter lists" button updates `lastUpdated` on success
- ✅ Manual refresh fails gracefully when offline (error toast, cached lists keep working)
- ✅ Guest windows never get the blocker injected
- ✅ No regressions in existing tests (47+ Rust tests for picker/PIN/reload, 159+ TS tests)
- ✅ Bundled snapshot ships in `apps/desktop/src-tauri/resources/adblock/` and is included in the binary

## Open questions

1. **YouTube scriptlet source for upstream refresh:** EasyList has a YouTube channel but it's primarily hostname rules. Real scriptlets come from uBO's GitHub repo, which is not designed as a fetch endpoint. **Decision:** v1 ships hand-curated scriptlets in the bundle. Upstream-refreshes ONLY update the EasyList/EasyPrivacy hostname lists. YouTube scriptlets update with app releases. Maintenance cost is acknowledged.
2. **Hostname extraction tooling:** Do we ship a build script that extracts hostnames from EasyList format, or commit the pre-extracted list directly? **Decision:** Commit pre-extracted `hostnames.txt` directly; document the extraction recipe in `apps/desktop/src-tauri/resources/adblock/README.md` for future maintainers.
3. **Refresh quota:** Should we rate-limit how often a user can click "Refresh filter lists" to avoid hammering easylist.to? **Decision:** Soft client-side cooldown (60 seconds between manual refreshes) handled in the store. No Rust-side enforcement.
