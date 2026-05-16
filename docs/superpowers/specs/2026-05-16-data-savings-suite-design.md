# Data Savings Suite — Design Spec

## Overview

Five user-facing features unified by one underlying truth: most Baobab users pay per-megabyte on slow connections. The suite makes data visible (chip, dashboard), makes pages lighter automatically (lazy-load, connection-aware loading), and stops the browser from spending data the user didn't ask for (Wi-Fi-only sync).

Approved decisions from brainstorm:
- **Budget period**: daily, resets at local midnight.
- **At 100% budget**: soft warning toast + auto-enable Slow mode (no hard block).
- **Wi-Fi-only sync default**: ON.

## Scope

In-scope (this spec):
- `useConnection` detection hook + Zustand store (`connection.store.ts`).
- `<NetworkChip>` in the tab strip.
- Lazy-load + connection-aware loading via the existing ad-blocker init-script.
- Data accounting: bytes used + bytes saved, per profile, with daily roll-over.
- Settings → Data section: budget config, Wi-Fi-sync toggle, manual Slow-mode toggle.
- Sync-gating: all profile-scoped cloud-client GET / push calls except auth.
- 80% and 100% threshold toasts.

Out-of-scope (future):
- Image compression proxy (Tier 3 in the roadmap).
- Per-tab data caps (Tier 2; reuses this suite's accounting).
- Hard block at 100% budget (deliberately rejected; soft-only).
- Auto-switching to lite versions of sites (Tier 2).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Browser process (chrome webview)                            │
│                                                             │
│   useConnection ──► connection.store ──┬──► <NetworkChip>   │
│      (browser API)                     ├──► <DataSection>   │
│                                        └──► slowMode flag   │
│                                                             │
│   data.store (per-profile, persisted)                       │
│     bytesUsed[day], bytesSaved[day], budgetMb               │
│      ▲                                                      │
│      │ increments from `data://usage` IPC event             │
│      │                                                      │
│   wifi-sync gate ──► wraps cloud-client calls               │
│                                                             │
└──────────────────────────────────────────────────────────────┘
                ▲ data://usage events
                │
┌─────────────────────────────────────────────────────────────┐
│ Tauri (Rust) + tab webviews                                 │
│                                                             │
│   tabs.rs: builder.initialization_script(adblock + data)    │
│                                                             │
│   adblock/engine.js (extended):                             │
│     fetch hook ── ► count response Content-Length           │
│                 ── ► sum blocked-request "savings" estimate │
│     image hook ── ► add loading="lazy" to <img>/<iframe>    │
│     slowmode  ── ► CSS injection + animation/font kill      │
│                                                             │
│   periodic `tab://usage` emit (one per second per tab)      │
│     payload: { bytesUsed: N, bytesSaved: N }                │
└──────────────────────────────────────────────────────────────┘
```

## Components

### 1. Connection detection — `~/state/connection.store.ts` (new, ~80 LoC)

Reads `navigator.connection` if present; falls back to `{ effectiveType: '4g', downlink: 10, saveData: false }` if absent (some WebView2 builds don't expose it).

```ts
type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'

interface ConnectionState {
  effectiveType: EffectiveType
  downlinkMbps: number       // best-effort estimate, may be 0
  saveData: boolean          // user's OS-level "Data Saver" flag
  isSlow: boolean            // derived
  isOffline: boolean         // navigator.onLine === false
  slowModeForced: boolean    // user toggle from Settings
}
```

`isSlow` computed: `effectiveType === 'slow-2g' || effectiveType === '2g' || downlinkMbps > 0 && downlinkMbps < 1.5`.

Subscribes to `change` event on `navigator.connection` so updates propagate without polling.

Connection-aware loading kicks in when `isSlow || slowModeForced || (data.store.bytesUsedToday >= budgetMb*1024*1024)`.

### 2. NetworkChip — `~/chrome/NetworkChip.tsx` (new, ~70 LoC)

Pill component, drops in next to the existing `<ResidencyChip>` in `TabStrip.tsx`. Same shape and colour vocabulary.

```
┌───────────────────────┐
│ ● Fast   30Mbps      │   green dot, isSlow=false
├───────────────────────┤
│ ● Slow   2G • Saving │   amber dot, isSlow=true
├───────────────────────┤
│ ○ Offline            │   grey, navigator.onLine=false
└───────────────────────┘
```

Click → opens Settings → Data section. Hover → tooltip explains current state.

Visibility rule: if `connection.effectiveType === 'unknown'` and we have no downlink data, hide the chip (don't surface noise).

### 3. Init-script extensions — `apps/desktop/src-tauri/resources/adblock/engine.js`

Three additions to the existing IIFE:

**3a. Lazy-load injection** (~20 LoC). When a `<img>` or `<iframe>` is added with no `loading` attr, set it to `"lazy"`. Existing MutationObserver already attaches; add a check.

```js
// Inside the existing MutationObserver loop, alongside the SCRIPT/IFRAME/IMG check.
if ((tag === 'IMG' || tag === 'IFRAME') && !node.hasAttribute('loading')) {
  node.setAttribute('loading', 'lazy')
}
```

Also a one-shot pass on existing DOM after the polled `installMutationObserver` finds the root, for `<img>`/`<iframe>` already in the document.

**3b. Byte accounting** (~30 LoC). Wrap `fetch` (already wrapped for ad-block) and `XHR.send` (already wrapped). Add:
- For blocked requests: estimate `bytesSaved` based on URL category. Image/script URLs → 50 KB default. Iframes (third-party ads) → 200 KB. Use a constant table; this is intentionally approximate.
- For allowed requests: read `Content-Length` header on response. If absent, count via streaming `Response.body` reader (cheap because we're a passive observer).

The init-script keeps running counters on `window.__bb_usage` and posts them up via:
```js
new MutationObserver(() => {}).observe // not this — instead use:
window.dispatchEvent(new CustomEvent('bb:usage-tick', { detail: { used: U, saved: S } }))
```
A new `bb_usage_relay` script the host webview injects relays the counts to Rust via `__TAURI_INVOKE__('record_tab_usage', { used, saved })`. Rust aggregates and emits `data://usage` event back to the chrome webview (debounced per-second).

Actually simpler: the init-script directly invokes a Tauri command at one-second tick intervals if `window.__TAURI_INVOKE__` exists.

**3c. Slow-mode CSS injection** (~10 LoC). When the host signals `bb_slow_mode = true` (via initial script param), inject a `<style>` block in `installMutationObserver`'s `attach()`:

```css
* { animation-duration: 0s !important; transition-duration: 0s !important; }
link[rel="preload"][as="font"] { display: none }
@font-face { font-display: optional !important; }
```

The host signals this by including `slowMode: true` in the JSON payload that Rust builds (same place we inject `BAOBAB_ADBLOCK`).

### 4. Data accounting store — `~/data/data.store.ts` (new, ~150 LoC)

Per-profile (scoped via existing `profileScoped` wrapper). Persists daily buckets.

```ts
interface DayBucket { dateKey: string; bytesUsed: number; bytesSaved: number }

interface DataState {
  history: DayBucket[]            // most recent 30 days
  budgetMb: number                // user-set, default 500
  hydrate: () => Promise<void>
  recordUsage: (used: number, saved: number) => void
  setBudget: (mb: number) => void
  today: () => DayBucket
  // Derived
  percentUsedToday: () => number
}
```

Day rollover via `dateKey = new Date().toLocaleDateString('en-CA')` (YYYY-MM-DD in local time). `recordUsage` checks today's bucket; if missing, creates one + trims history to 30 entries.

`recordUsage` is called from:
- The Tauri command handler (one `record_tab_usage` invoke per second per tab).
- Subscribers can derive `percentUsedToday()` for UI.

Threshold notifications fire from a subscriber that watches `percentUsedToday`:
- Crossing 80% → toast "200 MB left today. Slow mode kicks in at 0."
- Crossing 100% → toast + force `connection.store.slowModeForced = true`.
- New day starting → reset `slowModeForced` if user-set OFF.

### 5. Wi-Fi-only sync gate — `~/data/wifiGate.ts` (new, ~40 LoC)

Tiny wrapper that exposes `gate<T>(fn: () => Promise<T>): Promise<T | null>`. If `wifiSyncOnly === true` AND the connection isn't `4g`/`wifi`/`ethernet`, the wrapper short-circuits and returns `null` without invoking `fn`.

Three places to apply it:
- `digest.store.ts` `fetch()` action.
- `history.store.ts` push.
- `bookmarks.store.ts` push.

The connection-type WiFi-vs-cellular detection in browser is imperfect. Use:
- `navigator.connection.type === 'wifi' || 'ethernet'` if available.
- Otherwise treat `effectiveType === '4g'` as "probably Wi-Fi or fast LTE" — close enough for the alpha.

User can disable the gate entirely via Settings.

### 6. Settings — Data section — `~/settings/sections/DataSection.tsx` (new, ~180 LoC)

New section, slots into the existing `SettingsScreen` next to Privacy/AI. Layout:

```
DATA SAVINGS                                       [usage gauge]
                                                   ┌─────────┐
You've used 247 MB of 500 MB today                 │ ▓▓▓▓░░ │
You've saved 89 MB by blocking ads + lazy loading  │  49%   │
                                                   └─────────┘

Daily budget         [─────●──────────] 500 MB
                     50      500     2000

[ x ] Only sync on Wi-Fi
      Defers history, bookmarks, and the daily digest to Wi-Fi.

[ ] Force slow mode
    Acts as if connection is 2G regardless. Pages load lighter.

      Last 7 days
      ▁▂▅▃▆▂▁    280 MB used average
```

Sparkline reads `data.store.history`. The "Force slow mode" toggle sets `connection.store.slowModeForced`.

### 7. Notifications

Reuse the existing toast plumbing if it exists, else add a thin one. We don't have a toast system yet — fastest path is a `<DataToast>` rendered in `App.tsx` that watches the data store and renders for 4 seconds when a threshold is crossed.

## Data flow

1. User opens tab → tab webview boots → init-script attaches.
2. Init-script captures response `Content-Length`s + blocked-request estimates.
3. Once per second, init-script calls `__TAURI__.invoke('record_tab_usage', { used, saved, tabId })` if any changed.
4. Rust `record_tab_usage` command emits `data://usage` to the host window.
5. Host window's `data.store` subscribes (initListeners pattern), accumulates.
6. UI components reading the store re-render.
7. If percent crosses 80% → toast. If crosses 100% → toast + `slowModeForced = true`.
8. `connection.store.isSlowEffective` flips → init-script's slow-mode CSS injection becomes active for newly-loaded pages. (Existing pages don't retroactively get slow-mode; the new page they navigate to does.)

## File structure

**New files (8):**
- `apps/desktop/src/state/connection.store.ts`
- `apps/desktop/src/data/data.store.ts`
- `apps/desktop/src/data/data.api.ts`
- `apps/desktop/src/data/wifiGate.ts`
- `apps/desktop/src/data/DataToast.tsx`
- `apps/desktop/src/chrome/NetworkChip.tsx`
- `apps/desktop/src/settings/sections/DataSection.tsx`
- `apps/desktop/src-tauri/src/usage.rs`

**Modified files (8):**
- `apps/desktop/src-tauri/resources/adblock/engine.js` — lazy-load, byte accounting, slow-mode CSS.
- `apps/desktop/src-tauri/src/adblock.rs` — payload gets a `slowMode: bool` field.
- `apps/desktop/src-tauri/src/lib.rs` — register `record_tab_usage` command.
- `apps/desktop/src/chrome/TabStrip.tsx` — add `<NetworkChip>`.
- `apps/desktop/src/App.tsx` — wire `<DataToast>`, init data.store/connection.store.
- `apps/desktop/src/settings/SettingsScreen.tsx` — add Data section to nav.
- `apps/desktop/src/digest/digest.store.ts` — wrap fetch with `wifiGate`.
- `apps/desktop/src/history/history.store.ts` — wrap push with `wifiGate`.
- `apps/desktop/src/bookmarks/bookmarks.store.ts` — wrap push with `wifiGate`.

## Testing strategy

**Unit (Vitest, mocked navigator.connection):**
- `connection.store`: isSlow derivations for each effectiveType.
- `data.store`: day rollover at midnight, threshold crossing detection, 30-day history trim.
- `wifiGate`: passes through on wifi, blocks on cellular.
- `DataSection`: renders gauge correctly at 0% / 50% / 100%.

**Integration:**
- Mock the init-script's `record_tab_usage` invokes; verify data.store updates and toast fires at 80% / 100%.

**Manual smoke (final task):**
- Open NTP on real connection → chip reads correct state.
- Throttle connection via DevTools (Slow 3G) → chip turns amber, slow-mode CSS visible.
- Open a heavy site → byte counter ticks up in Settings.
- Set budget to 1 MB and load any page → 80% then 100% toasts; slow mode auto-enables.
- Turn Wi-Fi sync off and verify Continent Today still fetches even on cellular.

## Risks / decisions

- **Byte accounting is approximate.** Real-world cellular usage includes TLS handshakes, DNS, and CDN redirects that JS can't see. Underreports by ~10–20% vs OS-level metering. We label it "approximate" in the UI.
- **Privacy:** byte counters are per-profile and never leave the device. The host webview aggregates; no cloud sync of usage.
- **Slow mode CSS may break sites.** Some pages rely on transition durations as event-timing signals (e.g. animation-end). We accept the breakage on the rare-case site; users can toggle slow mode off.
- **No retroactive slow-mode application.** Pages already loaded keep their original CSS. New navigations and refreshes get slow mode. Documented in tooltip.
- **WebView2's `navigator.connection.type`** is sometimes "unknown" even on cellular. We fall back to `effectiveType === '4g'` as the proxy for "Wi-Fi or fast." Imperfect.

## Acceptance criteria

1. Network chip visible in tab strip on every profile window; reflects connection state within 1s of a `change` event.
2. Lazy-load adds `loading="lazy"` to all `<img>`/`<iframe>` lacking the attribute (verified by inspecting a heavy news site).
3. Slow-mode CSS injection cuts page weight on a chosen news site by ≥25% measured in DevTools Network tab (vs. without).
4. Data section shows today's used + saved bytes; reset confirmed at next-day boot.
5. Setting budget < current usage immediately triggers 100% toast + slow-mode.
6. Toggling Wi-Fi sync off on a cellular connection prevents `/api/continent-today` fetch on next session start; toggling back on resumes it.
7. All new code typechecks; all unit tests pass; manual smoke completes without console errors.
