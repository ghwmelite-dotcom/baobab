# Reader Auto-Savings (Data Savings Bundle B) — Design Spec

## Overview

Bundle B of the Data Savings Suite. The bundle's thesis is: most Baobab users pay per-megabyte on slow connections, and the biggest single bandwidth win is **not loading the heavy page in the first place**.

Reader Mode already ships as a manual omnibar action: user clicks the Reader icon → `ReaderPanel` overlay fetches a cleaned version of the current page via worker `/api/proxy/fetch` and renders DOMPurify-sanitized HTML. The piece missing today is the *policy* layer that makes Reader **proactive** when bandwidth matters — so that a cellular user typing a news URL never pays for the 3 MB version when 12 KB will do.

This bundle adds that policy layer, surfaces it through a 3-second "warn-then-open" countdown, intercepts the heavy navigation before the tab webview fetches the origin, renders the cleaned page in a new `reader.html` Vite entry (sibling to `picker.html` and `search.html`), and feeds the realised savings into Bundle A's `data.store` so the gauge in Settings tracks them alongside ad-block savings.

## Decisions locked (from brainstorm 2026-05-16)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Bundle B is Reader/Lite, not page translation | Translation already ships as `TranslatePad`. Full-page translation is more bandwidth, not less. |
| 2 | Evolve the existing Reader Mode, not build a parallel "Lite Mode" | Reader has the right primitives (KV cache, ad-strip, sanitization, offline-save). What's missing is policy. |
| 3 | Trigger UX = warn-then-open countdown (3s) | Honours Bundle A's "no hard block" principle. Tab never fetches the heavy page on accept. |
| 4 | Detection = always-on-slow + smart skip-list | Zero extra bandwidth (HEAD probe is itself a 2G round-trip). The countdown is the heuristic. |
| 5 | URL bar shows real URL + 📖 Reader pill | Preserves Ctrl+L/Ctrl+C standard. Bookmarks save the real URL. |
| 6 | Rendering = new `reader.html` Vite entry | Real history, real `document.location`, ad-blocker injection still applies. Matches search-portal pattern. |
| 7 | AI summary policy = skip on slow + opt-in "Summarize" pill | 5s wait + 6 KB defeats the bundle thesis. Opt-in teaches the feature exists. |
| 8 | Bytes-saved = domain-tier multiplier + ad-block bytes surfaced | Conservative HTML-diff would report 100 KB on a 3 MB save — gauge would look broken. |
| 9 | v1 intercept = TS-only at omnibar + tab strip. v1.x adds narrow Rust `on_navigation` hook for in-page link clicks. | Phased — ships data-savings now; in-page link interception is a focused follow-up scoped narrowly enough to be safe. |

## Scope

In-scope (this spec):
- `shouldInterceptNavigation(url)` policy in `src/reader/intercept.ts` (skip-list + 5-min override window).
- `<CountdownModal>` (3-sec countdown with Cancel / Open-now buttons).
- New `reader.html` Vite entry + `src/reader-app/` React tree.
- Omnibar `<ReaderPill>` next to the URL.
- `via_reader` per-tab state in `tabs.store`.
- Worker `/api/proxy/fetch` made **public** (drop `authMiddleware`).
- Worker computes and returns `bytes_saved` (domain-tier multiplier) and `bytes_saved_adblock` (already calculated, now surfaced).
- `reader-app` invokes `record_tab_usage(0, bytes_saved + bytes_saved_adblock)` so the Bundle A gauge reflects Reader savings.

Out-of-scope (deferred):
- **In-page link click intercept** — links clicked inside an already-loaded page bypass the countdown in v1. v1.x adds a narrow Rust `on_navigation` hook. Documented; not a bug.
- A keyboard shortcut to force Reader on Wi-Fi (Bundle A's manual "Force slow mode" toggle is the existing escape hatch).
- Per-domain telemetry-driven multiplier tuning.
- Auto-translation of Reader content into the user's language (separate later bundle).
- Hard block at 100% budget (deliberately rejected per Bundle A).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Profile (chrome) webview                                                │
│                                                                         │
│   Omnibar.tsx ─┐                                                        │
│   TabStrip.tsx ├──► reader/intercept.ts (NEW)                           │
│                │     shouldInterceptNavigation(url): bool               │
│                │       false if Wi-Fi class                             │
│                │       false if skip-list match                         │
│                │       false if user-override window (5min) active      │
│                │                                                        │
│                ├──► <CountdownModal /> (NEW)                            │
│                │     3-sec countdown · Cancel · Open now                │
│                │                                                        │
│                └──► ipcNavigateTab(tab, "reader.html?url=" + enc(url))  │
│                                                                         │
│   <ReaderPill>  ◄── tabs.store.tabs[id].via_reader                      │
│      "📖 Reader"  → click navigates the tab to the original URL +      │
│                     5-min override on the hostname                      │
└─────────────────────────────────────────────────────────────────────────┘
                                  │ ipcNavigateTab
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Tab webview (reader.html — new Vite entry, sibling to picker/search)    │
│                                                                         │
│   src/reader-app/main.tsx (NEW)                                         │
│     1. parse ?url=… from location.search                                │
│     2. POST /api/proxy/fetch  { url, skip_ai: isSlowEffective() }       │
│     3. DOMPurify.sanitize(cleaned_html) → render                        │
│     4. invoke('record_tab_usage', {                                     │
│             bytes_used: 0,   // engine.js already counted the fetch     │
│             bytes_saved: bytes_saved + bytes_saved_adblock              │
│        })                                                               │
│                                                                         │
│   header: "📖 saved ≈ 1.2 MB · [+ Summarize] · [Open full page]"        │
└─────────────────────────────────────────────────────────────────────────┘
                                  │ POST /api/proxy/fetch
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker                                                       │
│                                                                         │
│   /api/proxy/fetch  (PUBLIC now — authMiddleware removed)               │
│     • fetch origin → KV cache (existing, 1800s)                         │
│     • stripAds(raw) → { html, ads_blocked, bytes_saved_adblock }  (NEW) │
│     • extractReadable(html) → cleaned_html, word_count, etc.            │
│     • if !skip_ai && word_count > 50 → summarize via Workers AI         │
│     • bytes_saved = factorFor(host) × raw.length − response.length      │
│     • response: { ..., bytes_saved, bytes_saved_adblock }       (NEW)   │
│                                                                         │
│   /api/ai/summarize  (existing — driven by + Summarize pill)            │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          Bundle A's data.store
                          (accumulates bytesSaved in today's bucket)
```

## Components

### 1. Intercept policy — `src/reader/intercept.ts` (new, ~120 LoC)

```ts
import { useConnectionStore } from '~/state/connection.store'

/**
 * In-process per-window memory of "user cancelled the countdown for this host" —
 * used to suppress repeat prompts for 5 minutes. Per-window: profile-switching
 * naturally resets it (no persistence needed).
 */
const overrideUntil = new Map<string, number>()
const OVERRIDE_TTL_MS = 5 * 60 * 1000

/** Domains that should NEVER trigger the countdown, regardless of connection. */
const SKIP_HOSTS = new Set<string>([
  // search engines
  'google.com', 'www.google.com', 'bing.com', 'duckduckgo.com',
  // login flows
  'accounts.google.com', 'login.microsoftonline.com',
  // app-like
  'gmail.com', 'mail.google.com', 'github.com', 'web.whatsapp.com',
])
const SKIP_HOST_SUFFIXES: readonly string[] = ['.slack.com', '.app']
const SKIP_PATH_PATTERNS: readonly RegExp[] = [
  /^\/(login|signin|sign-in|auth)(\/|$)/i,
]

export function shouldInterceptNavigation(url: string): boolean {
  let parsed: URL
  try { parsed = new URL(url) } catch { return false }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const s = useConnectionStore.getState()
  if (!s.isSlowEffective()) return false

  // Skip-list
  const host = parsed.hostname.toLowerCase()
  if (SKIP_HOSTS.has(host)) return false
  if (SKIP_HOST_SUFFIXES.some((suf) => host.endsWith(suf))) return false
  if (SKIP_PATH_PATTERNS.some((re) => re.test(parsed.pathname))) return false

  // 5-min user-override window per host
  const until = overrideUntil.get(host)
  if (until && Date.now() < until) return false

  return true
}

export function markUserOverride(url: string): void {
  try {
    const host = new URL(url).hostname.toLowerCase()
    overrideUntil.set(host, Date.now() + OVERRIDE_TTL_MS)
  } catch { /* ignore */ }
}

/** @internal Test-only hatch — clears the in-process override map. */
export function __resetInterceptOverridesForTest(): void {
  overrideUntil.clear()
}
```

### 2. Countdown modal — `src/reader/CountdownModal.tsx` (new, ~110 LoC)

A centred overlay rendered in the chrome (`position: fixed`, `zIndex: 9100` — above tab webviews and existing toasts). Constraint: must be a sibling of `main`, not inside it (per the chrome-overlay rule).

Props:
```ts
interface CountdownModalProps {
  url: string
  seconds?: number  // default 3
  onCancel: () => void   // load full page
  onAccept: () => void   // proceed to Reader
}
```

Behaviour:
- Countdown ticks 3 → 2 → 1 → fires `onAccept` automatically
- Esc / click-outside fires `onCancel`
- Enter / "Open now" button fires `onAccept` immediately
- Honours `prefers-reduced-motion` (no fade animation when reduced)

### 3. Omnibar pill — `src/reader/ReaderPill.tsx` (new, ~50 LoC)

A small pill rendered inside the omnibar URL field when `tabs.store.tabs[activeId].via_reader === true`. Clicking it:
1. Calls `markUserOverride(originalUrl)` so the countdown doesn't fire on the next nav.
2. Calls `ipcNavigateTab(activeTab.id, originalUrl)`.

Styling matches the existing `<ResidencyChip>` / `<NetworkChip>` vocabulary (Sahel canvas, warn accent).

### 4. Reader app entry — `src/reader-app/main.tsx`, `src/reader-app/ReaderApp.tsx` (new, ~200 LoC total)

`main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ReaderApp } from './ReaderApp'

ReactDOM.createRoot(document.getElementById('root')!).render(<ReaderApp />)
```

`ReaderApp.tsx` flow:
1. Parse `?url=` from `location.search`; reject if missing.
2. Determine `skip_ai` by checking `navigator.connection?.effectiveType` + saveData (connection.store isn't visible in this webview).
3. POST to worker:
   ```ts
   const r = await fetch(API_BASE + '/api/proxy/fetch', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ url, skip_ai }),
   })
   ```
4. On success: render cleaned HTML via DOMPurify; report savings via `__TAURI_INTERNALS__.invoke('record_tab_usage', { ... })`.
5. On failure: render `<ErrorPane>` with "Load full page" button.
6. Footer pill: `+ Summarize` (visible when AI was skipped) calls `/api/ai/summarize` via SSE and streams the summary in above the article.

### 5. Tab state — modify `src/state/tabs.store.ts`

Add `via_reader: boolean` to the `Tab` interface; set to `true` when the URL the tab is navigating to begins with `reader.html?url=`. Computed at navigation time, persisted in tab snapshot.

```ts
function isReaderUrl(url: string): { via: true; original: string } | { via: false } {
  if (!url.startsWith('reader.html?')) return { via: false }
  const p = new URLSearchParams(url.slice('reader.html?'.length))
  const original = p.get('url')
  return original ? { via: true, original } : { via: false }
}
```

`tabs.store` exposes `originalUrlFor(tabId)` so the Omnibar can render the real URL even when the tab webview's actual URL is `reader.html?url=…`.

### 6. Omnibar integration — modify `src/chrome/Omnibar.tsx`

Two changes:
1. **Display:** when the active tab is `via_reader`, render `<ReaderPill>` + the original URL (via `originalUrlFor`).
2. **Intercept:** before calling `ipcNavigateTab` (the existing submit handler), wrap:
   ```ts
   const onSubmit = async (url: string) => {
     if (shouldInterceptNavigation(url)) {
       const accept = await openCountdownAndWait(url)
       if (!accept) {
         markUserOverride(url)
         return ipcNavigateTab(activeTabId, url)  // load full page
       }
       return ipcNavigateTab(activeTabId, `reader.html?url=${encodeURIComponent(url)}`)
     }
     return ipcNavigateTab(activeTabId, url)
   }
   ```

`openCountdownAndWait(url)` mounts the `<CountdownModal>` in an app-level slot and resolves with `true` (accepted/timeout) or `false` (cancelled).

### 7. TabStrip integration — modify `src/chrome/TabStrip.tsx`

Same gate at the new-tab-with-URL path. New-tab-with-blank-URL bypasses (no URL → nothing to classify).

### 8. Vite config — modify `apps/desktop/vite.config.ts`

Add `reader: resolve(__dirname, 'reader.html')` to `rollupOptions.input` alongside the existing entries. New `apps/desktop/reader.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Reader · Baobab</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/reader-app/main.tsx"></script>
  </body>
</html>
```

## Worker changes

### `worker/src/routes/proxy.ts`

Three changes:

**1. Drop authMiddleware from the route.** It's incompatible with reader.html being a fresh JS context that doesn't carry the parent profile's auth.store. Mirrors the search-portal v1 change (`/api/ai/search` is similarly public). Rate-limit middleware stays unchanged — `rateLimit` already prefers `c.get('userId')` post-auth and falls back to `ip:${CF-Connecting-IP}` for unauthenticated traffic (`worker/src/middleware/rate-limit.ts:24–26`), so simply removing authMiddleware gives us per-IP limiting automatically.

**2. Surface `bytes_saved` and `bytes_saved_adblock`.** Compute via `factorFor()` (see service change), include in response JSON. The `adblock_stats` D1 write becomes conditional on `c.get('userId')` (still attributed when an auth header is present, anonymous otherwise — no D1 write).

**3. Make the D1 write graceful.** Today the route writes an `adblock_stats` row keyed on `user_id`. With anon users, either skip the write or insert with NULL `user_id`. Pick **skip**: a NULL pattern muddies analytics.

### `worker/src/services/reader.ts`

Add `factorFor()` and surface `stripAds`'s savings via the response. The existing `stripAds()` already computes ad-stripping. New helper:

```ts
const FACTOR_TABLE: readonly [RegExp, number][] = [
  // News
  [/(?:^|\.)nytimes\.com$/, 8],
  [/(?:^|\.)bbc\.(co\.uk|com)$/, 8],
  [/(?:^|\.)cnn\.com$/, 8],
  [/(?:^|\.)guardian\.co\.uk$/, 8],
  [/(?:^|\.)washingtonpost\.com$/, 8],
  [/(?:^|\.)reuters\.com$/, 8],
  // Blog platforms
  [/(?:^|\.)medium\.com$/, 5],
  [/(?:^|\.)substack\.com$/, 5],
  [/(?:^|\.)wordpress\.com$/, 5],
  [/\.blogspot\./, 5],
  // App-like (rarely useful as Reader, but include for completeness)
  [/(?:^|\.)slack\.com$/, 2],
  [/(?:^|\.)github\.com$/, 2],
  [/(?:^|\.)app$/, 2],
]
const DEFAULT_FACTOR = 4

export function factorFor(hostname: string): number {
  const h = hostname.toLowerCase()
  for (const [re, f] of FACTOR_TABLE) {
    if (re.test(h)) return f
  }
  return DEFAULT_FACTOR
}
```

In the route, after `extractReadable` and (conditionally) AI summary:
```ts
const responseBody = { title, cleaned_html, text, word_count, est_read_minutes,
                       ads_blocked, trackers_blocked, ai_summary, key_points, cached: false }
const responseSize = JSON.stringify(responseBody).length
const fullPageEstimate = factorFor(parsed.hostname) * raw.length
const bytes_saved = Math.max(0, fullPageEstimate - responseSize)
const bytes_saved_adblock = Math.max(0, raw.length - html.length)
return c.json({ ...responseBody, bytes_saved, bytes_saved_adblock })
```

### `worker/src/index.ts`

Confirm `CORS_ORIGIN` includes `tauri://localhost` and (dev) `localhost:1420`. Search-portal v1 already required this; no new value needed.

## Data flow

1. User on a slow connection types `https://nytimes.com/article/xyz` in the Omnibar and presses Enter.
2. `Omnibar.tsx` calls `shouldInterceptNavigation(url)`:
   - `useConnectionStore.getState().isSlowEffective() === true`
   - `nytimes.com` not in skip-list
   - No 5-min override active for this hostname
   - returns `true`
3. Omnibar opens the `<CountdownModal>`. After 3 seconds (or Enter / "Open now"), it resolves accepted.
4. Omnibar calls `ipcNavigateTab(activeTabId, "reader.html?url=https%3A%2F%2Fnytimes.com%2Farticle%2Fxyz")`.
5. Tab webview navigates to `reader.html`, which loads the `src/reader-app/` bundle.
6. `ReaderApp` reads `?url=…`, POSTs `{ url, skip_ai: true }` to `/api/proxy/fetch`.
7. Worker: KV cache miss → fetches origin → `stripAds` → `extractReadable` → no AI (skip_ai). Computes `bytes_saved = factorFor('nytimes.com') × raw.length − responseSize` = `8 × 250 KB − 60 KB ≈ 1.94 MB`. Returns JSON with `bytes_saved` and `bytes_saved_adblock`. Caches under `reader:<sha256(url)>` for 1800 s.
8. `ReaderApp` sanitizes `cleaned_html` with DOMPurify, renders. Header shows `📖 saved ≈ 1.94 MB`.
9. `ReaderApp` invokes `record_tab_usage` with `bytes_used: 0` and `bytes_saved: 1_940_000 + bytes_saved_adblock`. The `bytes_used` side is **not** reported here because the existing engine.js fetch hook (Bundle A) already counted the `/api/proxy/fetch` response's `Content-Length` — double-counting would be the bug.
10. `usage.rs` debounces, emits `data://usage`. Bundle A's `data.store` accumulates today's bucket. The Settings → Data gauge ticks up.
11. The Omnibar reads `tabs.store.tabs[activeId].via_reader === true` and renders the `<ReaderPill>` next to the original URL.

## Error handling

| Failure | Behaviour |
|---------|-----------|
| Worker `/api/proxy/fetch` returns 5xx | `ReaderApp` renders `<ErrorPane>` with "Load full page" button → navigate tab to original URL |
| Origin blocks BaobabBot UA (403) | Same fall-through |
| `extractReadable` produces empty `cleaned_html` | Worker returns 422 (new); `ReaderApp` falls through to full page |
| Origin redirect to login wall (low `word_count`) | `ReaderApp` checks `word_count < 50` AND no useful title → fall through to full page |
| User goes offline mid-fetch | Browser handles tab error; `ReaderPill` not rendered |
| `isOffline === true` | `shouldInterceptNavigation` returns `false` — countdown never fires |
| Network failure during countdown | Countdown still elapses, but the subsequent `proxy/fetch` call fails → fall through |
| User opts in to `+ Summarize` but AI 5xx | Inline error in the summary slot; article still readable |
| `record_tab_usage` IPC unavailable (test/env) | Caller catches and logs; UI unaffected |

## File structure

**New (10):**
- `apps/desktop/reader.html`
- `apps/desktop/src/reader-app/main.tsx`
- `apps/desktop/src/reader-app/ReaderApp.tsx`
- `apps/desktop/src/reader-app/SummarizePill.tsx`
- `apps/desktop/src/reader/intercept.ts`
- `apps/desktop/src/reader/CountdownModal.tsx`
- `apps/desktop/src/reader/ReaderPill.tsx`
- `apps/desktop/tests/reader.intercept.test.ts`
- `apps/desktop/tests/reader.countdown.test.tsx`
- `apps/desktop/tests/reader.app.test.tsx`

**Modified (8):**
- `apps/desktop/vite.config.ts` — add `reader` Vite entry.
- `apps/desktop/src/chrome/Omnibar.tsx` — invoke `shouldInterceptNavigation`, render `<ReaderPill>`.
- `apps/desktop/src/chrome/TabStrip.tsx` — same gate at new-tab-with-URL.
- `apps/desktop/src/state/tabs.store.ts` — `via_reader` field + `originalUrlFor(id)`.
- `worker/src/routes/proxy.ts` — drop authMiddleware on `/fetch`, surface `bytes_saved` + `bytes_saved_adblock`, IP-keyed rate-limit, anon writes skipped.
- `worker/src/services/reader.ts` — add `factorFor()` table.
- `worker/src/index.ts` — confirm CORS allowlist (likely no diff if search-portal already added it).
- `worker/test/proxy.test.ts` — public route, bytes_saved math, factor classification.

## Testing strategy

**Unit (Vitest, jsdom):**
- `shouldInterceptNavigation`: skip-list matches (each pattern type), 5-min override window, Wi-Fi short-circuit, offline short-circuit, malformed URL.
- `<CountdownModal>`: counts down, fires `onAccept` on elapse, Esc fires `onCancel`, Enter fires `onAccept`, click-outside fires `onCancel`, respects `prefers-reduced-motion`.
- `<ReaderApp>`: mocked fetch → renders sanitized HTML; mocked fetch failure → renders error pane with "Load full page" button.
- `<SummarizePill>`: hidden when `ai_summary` non-empty; clicking fires SSE call; renders streamed tokens.
- `tabs.store`: `via_reader` flag flips correctly on navigation; `originalUrlFor` round-trips.

**Integration (Vitest jsdom):**
- Omnibar submit on slow-mode-classified URL → countdown renders → accept → `ipcNavigateTab` called with `reader.html?url=…`.
- Omnibar submit on Wi-Fi → countdown does NOT render; navigates directly to the URL.
- Cancel during countdown → `markUserOverride` called + tab navigates to original URL.

**Worker (Vitest, miniflare):**
- `/api/proxy/fetch` is public (no 401 on unauthenticated POST).
- Per-IP rate limit fires after 30 requests/min.
- `factorFor()` classification covers every row in the table + default.
- `bytes_saved` math: feed a fixed `raw` HTML fixture, assert `bytes_saved = factor × len − response.length`.
- `bytes_saved_adblock` is non-zero when ads are present in the raw HTML.
- Anonymous request: no D1 `adblock_stats` row written.
- Authenticated request: D1 row IS written (back-compat).

**Manual smoke (executed by the user after merge):**
1. DevTools throttle to Slow 3G. Type a `nytimes.com/...` URL → countdown appears.
2. Accept the countdown → tab navigates to `reader.html?url=…`, renders cleaned article in ~600ms, shows `≈` saving in the header.
3. Click the `📖 Reader` pill → tab navigates to the full page; subsequent same-host typing doesn't re-prompt for 5 min.
4. Click `+ Summarize` → AI summary streams in above the article.
5. Switch to Wi-Fi → typing the same URL navigates directly; no countdown.
6. Open Settings → Data: gauge has ticked up by the saved amount.
7. Set budget to 1 MB and Reader twice: 80% then 100% toasts fire (Bundle A integration).

## Risks / decisions

- **Bytes-saved is a heuristic.** The domain-tier multiplier will over- or under-estimate any specific page. v1 acceptance asks for "within ~3× of OS-level metering on 3 hand-picked news sites" — telemetry-tunable later.
- **Article-body images still fetch from origin.** `extractReadable` strips `<header>`/`<nav>`/`<aside>`/`<footer>`/`<script>`/`<style>` but **keeps `<img>` tags inside the article element.** So reader.html will fetch in-body photos directly from origin — Bundle A's engine.js `loading="lazy"` injection (Bundle A item 2) defers those to scroll-into-view, and slow-mode CSS suppresses fonts/animations on reader.html as it does for any tab. Net effect: viewport-visible photos still load. On photo-heavy articles, real savings may be ~20–30% smaller than the multiplier reports. Acceptable v1; a future option could strip `<img>` on slow-mode with tap-to-load placeholders.
- **`/api/proxy/fetch` is now public.** Per-IP rate limit is the only abuse boundary. If abuse becomes real (someone scraping via this endpoint), tightening is straightforward (lower the limit; add Turnstile; add per-IP daily quota).
- **In-page link clicks bypass v1.** A clicked link on a Reader-rendered page goes through the same flow (it's chrome-mediated). A clicked link on a *normal* page is webview-internal and bypasses. Documented; the Reader pill's "Open full page" + the cellular user's habit of typing URLs cover most of the slow-mode value.
- **Skip-list is hardcoded for v1.** No user-editable allowlist/skiplist. Acceptable for alpha; "edit skip list" is a v2 ticket.
- **The 5-min override is per-window in-process.** Profile-switch resets it. Acceptable — each profile gets its own learning.
- **`reader.html` is unauthenticated.** Origin-side a malicious page can't read user state because it's a fresh webview. URL leakage to the worker is the same as any other navigation (the worker already fetches origin URLs).
- **Reader fall-through on extraction failure** could end up loading the heavy page on a slow connection — exactly what the bundle is meant to avoid. Accepted: that page was unworkable in Reader anyway; fall-through is the only sane response.

## Acceptance criteria

1. **Trigger** — On `isSlowEffective() === true`, typing or pasting a non-skip-listed URL in the Omnibar opens a 3-sec countdown modal. Esc/click-outside cancels; Enter/elapse accepts.
2. **Skip-list** — Typing `gmail.com`, `https://google.com/search?q=foo`, or `https://github.com/owner/repo` never triggers the countdown.
3. **Override window** — Cancelling the countdown on a host suppresses the prompt on subsequent navigations to the same host for 5 minutes.
4. **Reader render** — Accepting the countdown navigates the tab to `reader.html?url=…`, which renders cleaned HTML (DOMPurify-sanitized) within 1 s on Slow 3G (article-body images preserved; header/nav/aside/footer/script/style stripped server-side by `extractReadable`).
5. **Pill** — While the active tab is via-Reader, the Omnibar shows the real URL with a `📖 Reader` pill that, when clicked, navigates to the original URL and arms the 5-min override.
6. **Skip AI on slow** — When `isSlowEffective()`, `/api/proxy/fetch` is called with `skip_ai: true`; no `ai_summary` returned; the article body appears in the timing target above. A `+ Summarize` pill renders and, when clicked, streams the summary in.
7. **Gauge integration** — Each successful Reader render increments Bundle A's `data.store.bytesSaved` by `bytes_saved + bytes_saved_adblock`. The Settings → Data gauge reflects this. Magnitude is within ~3× of OS-level metering on hand-picked news sites.
8. **Public route** — `POST /api/proxy/fetch` succeeds without an `Authorization` header. Per-IP rate limit kicks in after 30 requests/min.
9. **All new code typechecks.** All new unit + integration + worker tests pass. Manual smoke completes without console errors.

## Open items intentionally deferred to v1.x or later

- Rust `on_navigation` hook for in-page link clicks (v1.x).
- Telemetry-driven tuning of the multiplier table.
- User-editable skip-list (Settings → Data).
- Per-domain factor learning from observed OS metering.
- Auto-translation of Reader content into the user's selected language (Bundle E candidate).
