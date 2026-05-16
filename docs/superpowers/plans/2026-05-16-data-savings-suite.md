# Data Savings Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five Tier 1 data-savings features (lazy-load 1.3, budget dashboard 1.4, Wi-Fi-only sync 1.5, network quality chip 8.1, connection-aware loading 8.3) as a single coherent bundle, unified by a connection-detection store and an extended ad-blocker init-script that performs byte accounting.

**Architecture:** New `connection.store` (Zustand) reads `navigator.connection`. New `data.store` (per-profile, daily buckets) accumulates byte usage from the tab init-script via a Tauri event bridge. The existing ad-blocker `engine.js` gains three sibling responsibilities: lazy-load attribute injection, byte counting (Content-Length + blocked-request savings estimates), and slow-mode CSS injection. UI adds: `<NetworkChip>` next to ResidencyChip, Settings → Data section with gauge + 7-day sparkline + Wi-Fi sync toggle + budget slider, and a `<DataToast>` that fires at 80% / 100% thresholds. Wi-Fi gate wraps cloud-client GET/PUSH calls in three stores.

**Tech Stack:** TypeScript + React 18, Zustand with `profileScoped` persistence (existing pattern), Tauri 2 (new `record_tab_usage` command, new `data://usage` event), Rust 2021 edition, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-16-data-savings-suite-design.md`

---

## File Structure

### New frontend files (7)
- `apps/desktop/src/state/connection.store.ts` — `useConnectionStore`, reads `navigator.connection`, derives `isSlow`
- `apps/desktop/src/data/data.store.ts` — `useDataStore`, day buckets, budget, threshold detection
- `apps/desktop/src/data/data.api.ts` — listener for `data://usage` Tauri events
- `apps/desktop/src/data/wifiGate.ts` — `gate()` wrapper that short-circuits on cellular
- `apps/desktop/src/data/DataToast.tsx` — threshold-crossing toast renderer
- `apps/desktop/src/chrome/NetworkChip.tsx` — pill next to ResidencyChip
- `apps/desktop/src/settings/sections/DataSection.tsx` — gauge + sparkline + controls

### New Rust files (1)
- `apps/desktop/src-tauri/src/usage.rs` — `record_tab_usage` command, debounced emit of `data://usage`

### New test files (4)
- `apps/desktop/tests/connection.store.test.ts` — slowness derivation (4 tests)
- `apps/desktop/tests/data.store.test.ts` — day rollover, threshold detection (5 tests)
- `apps/desktop/tests/wifi.gate.test.ts` — passthrough vs short-circuit (3 tests)
- `apps/desktop/tests/data.section.test.tsx` — gauge rendering at 0/50/100% (3 tests)

### Modified files (8)
- `apps/desktop/src-tauri/resources/adblock/engine.js` — lazy-load, byte accounting, slow-mode CSS
- `apps/desktop/src-tauri/src/adblock.rs` — payload gains `slowMode: bool`
- `apps/desktop/src-tauri/src/lib.rs` — register `record_tab_usage`
- `apps/desktop/src/chrome/TabStrip.tsx` — render `<NetworkChip>`
- `apps/desktop/src/App.tsx` — mount `<DataToast>`, hydrate stores
- `apps/desktop/src/settings/SettingsScreen.tsx` — add Data section to nav
- `apps/desktop/src/digest/digest.store.ts` — wrap fetch with `wifiGate`
- `apps/desktop/src/history/history.store.ts` — wrap push with `wifiGate`
- `apps/desktop/src/bookmarks/bookmarks.store.ts` — wrap push with `wifiGate`

---

## Phase 1 — Foundation stores

### Task 1: `connection.store.ts`

**Files:**
- Create: `apps/desktop/src/state/connection.store.ts`
- Create: `apps/desktop/tests/connection.store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/connection.store.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

beforeEach(() => {
  // Default mock: 4g, not saveData, online.
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { effectiveType: '4g', downlink: 10, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
  })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('connection.store', () => {
  it('treats 4g + 10 Mbps downlink as fast', async () => {
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(false)
  })

  it('treats slow-2g as slow', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: 'slow-2g', downlink: 0.05, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(true)
  })

  it('treats downlink < 1.5 as slow even if effectiveType is 4g', async () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '4g', downlink: 0.8, saveData: false, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    })
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    expect(useConnectionStore.getState().isSlow).toBe(true)
  })

  it('forces slow when slowModeForced is true', async () => {
    const { useConnectionStore } = await import('~/state/connection.store')
    useConnectionStore.getState().sync()
    useConnectionStore.setState({ slowModeForced: true })
    expect(useConnectionStore.getState().isSlowEffective()).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

```
cd apps/desktop && npx vitest run tests/connection.store.test.ts
```
Expected: 4 failures (`Cannot find module '~/state/connection.store'`).

- [ ] **Step 3: Create `apps/desktop/src/state/connection.store.ts`**

```ts
import { create } from 'zustand'

export type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'

interface NavigatorConnectionLike {
  effectiveType?: EffectiveType
  downlink?: number
  saveData?: boolean
  type?: string
  addEventListener?: (ev: string, cb: () => void) => void
  removeEventListener?: (ev: string, cb: () => void) => void
}

function readConnection(): NavigatorConnectionLike {
  const c = (navigator as Navigator & { connection?: NavigatorConnectionLike }).connection
  return c ?? {}
}

interface ConnectionState {
  effectiveType: EffectiveType
  downlinkMbps: number
  saveData: boolean
  type: string                  // 'wifi' | 'ethernet' | 'cellular' | etc., or '' if unknown
  isOffline: boolean
  isSlow: boolean
  slowModeForced: boolean
  sync: () => void
  isSlowEffective: () => boolean
  setForced: (forced: boolean) => void
}

function compute(c: NavigatorConnectionLike): { effectiveType: EffectiveType; downlinkMbps: number; saveData: boolean; type: string; isSlow: boolean } {
  const effectiveType = (c.effectiveType ?? 'unknown') as EffectiveType
  const downlinkMbps = typeof c.downlink === 'number' ? c.downlink : 0
  const saveData = c.saveData === true
  const type = typeof c.type === 'string' ? c.type : ''
  const isSlow =
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    (downlinkMbps > 0 && downlinkMbps < 1.5) ||
    saveData
  return { effectiveType, downlinkMbps, saveData, type, isSlow }
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  effectiveType: 'unknown',
  downlinkMbps: 0,
  saveData: false,
  type: '',
  isOffline: false,
  isSlow: false,
  slowModeForced: false,

  sync: () => {
    const next = compute(readConnection())
    set({ ...next, isOffline: !navigator.onLine })
  },

  setForced: (forced) => set({ slowModeForced: forced }),

  isSlowEffective: () => {
    const s = get()
    return s.isSlow || s.slowModeForced
  },
}))

/** Attach listeners to navigator.connection + onLine/offline. Idempotent. */
let attached = false
export function attachConnectionListeners(): () => void {
  if (attached) return () => undefined
  attached = true
  const c = readConnection()
  const onChange = () => useConnectionStore.getState().sync()
  c.addEventListener?.('change', onChange)
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  useConnectionStore.getState().sync()
  return () => {
    c.removeEventListener?.('change', onChange)
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
    attached = false
  }
}
```

- [ ] **Step 4: Re-run the test, verify it passes**

```
npx vitest run tests/connection.store.test.ts
```
Expected: 4/4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/state/connection.store.ts apps/desktop/tests/connection.store.test.ts
git commit -m "feat(data): connection.store — navigator.connection wrapper + isSlow derivation"
```

---

### Task 2: `data.store.ts` — per-profile daily buckets

**Files:**
- Create: `apps/desktop/src/data/data.store.ts`
- Create: `apps/desktop/tests/data.store.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/data.store.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('~/state/persistence', () => {
  const store = new Map<string, unknown>()
  const persistence = {
    get: vi.fn((k: string) => Promise.resolve(store.get(k))),
    set: vi.fn((k: string, v: unknown) => { store.set(k, v); return Promise.resolve() }),
    delete: vi.fn((k: string) => { store.delete(k); return Promise.resolve() }),
  }
  const profileScoped = (id: string) => {
    const prefix = `profile.${id}.`
    return {
      get: (k: string) => persistence.get(prefix + k),
      set: (k: string, v: unknown) => persistence.set(prefix + k, v),
      delete: (k: string) => persistence.delete(prefix + k),
    }
  }
  return { persistence, profileScoped }
})

import { useDataStore } from '~/data/data.store'

beforeEach(() => {
  useDataStore.setState({ history: [], budgetMb: 500 })
  useDataStore.getState().setProfileId('p1')
})

describe('data.store', () => {
  it('creates today\'s bucket on first recordUsage', () => {
    useDataStore.getState().recordUsage(1000, 200)
    const today = useDataStore.getState().today()
    expect(today.bytesUsed).toBe(1000)
    expect(today.bytesSaved).toBe(200)
  })

  it('accumulates into the same bucket across calls', () => {
    useDataStore.getState().recordUsage(1000, 200)
    useDataStore.getState().recordUsage(500, 100)
    const today = useDataStore.getState().today()
    expect(today.bytesUsed).toBe(1500)
    expect(today.bytesSaved).toBe(300)
  })

  it('returns a fresh bucket on a new day', () => {
    // Force a stale yesterday bucket.
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
    useDataStore.setState({ history: [{ dateKey: yesterday, bytesUsed: 9999, bytesSaved: 0 }] })
    useDataStore.getState().recordUsage(100, 50)
    const today = useDataStore.getState().today()
    expect(today.bytesUsed).toBe(100)
    expect(useDataStore.getState().history.length).toBe(2)
  })

  it('trims history past 30 days', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({
      dateKey: `2026-01-${String(i + 1).padStart(2, '0')}`,
      bytesUsed: 0, bytesSaved: 0,
    }))
    useDataStore.setState({ history })
    useDataStore.getState().recordUsage(1, 0)
    expect(useDataStore.getState().history.length).toBeLessThanOrEqual(30)
  })

  it('percentUsedToday respects the budget', () => {
    useDataStore.getState().setBudget(1) // 1 MB
    useDataStore.getState().recordUsage(512 * 1024, 0) // 512 KB
    expect(useDataStore.getState().percentUsedToday()).toBeCloseTo(50, 0)
  })
})
```

- [ ] **Step 2: Run the test, verify it fails**

```
npx vitest run tests/data.store.test.ts
```
Expected: 5 failures (module not found).

- [ ] **Step 3: Create `apps/desktop/src/data/data.store.ts`**

```ts
import { create } from 'zustand'
import { profileScoped } from '~/state/persistence'

type Scoped = ReturnType<typeof profileScoped>

export interface DayBucket {
  dateKey: string        // YYYY-MM-DD in local time
  bytesUsed: number
  bytesSaved: number
}

interface DataState {
  history: DayBucket[]
  budgetMb: number
  setProfileId: (id: string) => void
  hydrate: () => Promise<void>
  recordUsage: (used: number, saved: number) => void
  setBudget: (mb: number) => void
  today: () => DayBucket
  percentUsedToday: () => number
}

const STORAGE_KEY = 'data.dailyBuckets'
const BUDGET_KEY = 'data.budgetMb'
const HISTORY_MAX = 30

let scope: Scoped | null = null

function todayKey(): string {
  // en-CA gives YYYY-MM-DD, which sorts correctly and is unambiguous.
  return new Date().toLocaleDateString('en-CA')
}

function getOrCreateToday(history: DayBucket[]): { bucket: DayBucket; nextHistory: DayBucket[] } {
  const key = todayKey()
  const existing = history.find((b) => b.dateKey === key)
  if (existing) return { bucket: existing, nextHistory: history }
  const bucket: DayBucket = { dateKey: key, bytesUsed: 0, bytesSaved: 0 }
  // Append, sort by date asc, trim oldest.
  const merged = [...history, bucket].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const trimmed = merged.length > HISTORY_MAX ? merged.slice(merged.length - HISTORY_MAX) : merged
  return { bucket, nextHistory: trimmed }
}

export const useDataStore = create<DataState>()((set, get) => ({
  history: [],
  budgetMb: 500,

  setProfileId: (id) => {
    scope = profileScoped(id)
  },

  hydrate: async () => {
    if (!scope) return
    const [hist, budget] = await Promise.all([
      scope.get<DayBucket[]>(STORAGE_KEY),
      scope.get<number>(BUDGET_KEY),
    ])
    set({
      history: Array.isArray(hist) ? hist : [],
      budgetMb: typeof budget === 'number' && budget > 0 ? budget : 500,
    })
  },

  recordUsage: (used, saved) => {
    set((s) => {
      const { bucket, nextHistory } = getOrCreateToday(s.history)
      const updatedBucket: DayBucket = {
        ...bucket,
        bytesUsed: bucket.bytesUsed + used,
        bytesSaved: bucket.bytesSaved + saved,
      }
      const history = nextHistory.map((b) => (b.dateKey === updatedBucket.dateKey ? updatedBucket : b))
      // Persist asynchronously (debounce omitted for simplicity; writes per tick are rare).
      if (scope) void scope.set(STORAGE_KEY, history)
      return { history }
    })
  },

  setBudget: (mb) => {
    const clamped = Math.max(1, Math.min(10_000, Math.round(mb)))
    set({ budgetMb: clamped })
    if (scope) void scope.set(BUDGET_KEY, clamped)
  },

  today: () => {
    const { bucket } = getOrCreateToday(get().history)
    return bucket
  },

  percentUsedToday: () => {
    const t = get().today()
    const budgetBytes = get().budgetMb * 1024 * 1024
    if (budgetBytes <= 0) return 0
    return (t.bytesUsed / budgetBytes) * 100
  },
}))
```

- [ ] **Step 4: Re-run the test, verify it passes**

```
npx vitest run tests/data.store.test.ts
```
Expected: 5/5 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/data/data.store.ts apps/desktop/tests/data.store.test.ts
git commit -m "feat(data): data.store — per-profile daily buckets + budget"
```

---

### Task 3: `wifiGate.ts`

**Files:**
- Create: `apps/desktop/src/data/wifiGate.ts`
- Create: `apps/desktop/tests/wifi.gate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/wifi.gate.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useConnectionStore } from '~/state/connection.store'
import { gate, setWifiOnlySync } from '~/data/wifiGate'

beforeEach(() => {
  useConnectionStore.setState({ effectiveType: '4g', type: 'wifi', isOffline: false, isSlow: false, downlinkMbps: 30 })
  setWifiOnlySync(true)
})

describe('wifiGate.gate', () => {
  it('runs the fn when type is wifi', async () => {
    const fn = vi.fn(async () => 'ran')
    expect(await gate(fn)).toBe('ran')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('short-circuits when type is cellular and wifiOnly is on', async () => {
    useConnectionStore.setState({ type: 'cellular', effectiveType: '3g' })
    const fn = vi.fn(async () => 'ran')
    expect(await gate(fn)).toBe(null)
    expect(fn).not.toHaveBeenCalled()
  })

  it('runs the fn on cellular when wifiOnly is off', async () => {
    useConnectionStore.setState({ type: 'cellular' })
    setWifiOnlySync(false)
    const fn = vi.fn(async () => 'ran')
    expect(await gate(fn)).toBe('ran')
  })
})
```

- [ ] **Step 2: Run, verify it fails (module not found)**

```
npx vitest run tests/wifi.gate.test.ts
```

- [ ] **Step 3: Create `apps/desktop/src/data/wifiGate.ts`**

```ts
import { useConnectionStore } from '~/state/connection.store'

let wifiOnlySync = true

export function setWifiOnlySync(on: boolean): void {
  wifiOnlySync = on
}

export function isWifiOnlySync(): boolean {
  return wifiOnlySync
}

/**
 * If wifiOnlySync is enabled AND the connection isn't Wi-Fi-class, short-circuit
 * with `null` instead of invoking `fn`. Caller treats `null` as "deferred."
 *
 * Wi-Fi-class = navigator.connection.type === 'wifi' / 'ethernet', OR (when
 * type is unknown) effectiveType === '4g'. Cellular detection in the browser
 * is imperfect; the 4g fallback is a pragmatic compromise documented in the spec.
 */
export async function gate<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!wifiOnlySync) return fn()
  const c = useConnectionStore.getState()
  const t = c.type
  const wifiClass = t === 'wifi' || t === 'ethernet' || (t === '' && c.effectiveType === '4g')
  if (!wifiClass) return null
  return fn()
}
```

- [ ] **Step 4: Run, verify 3/3 pass**

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/data/wifiGate.ts apps/desktop/tests/wifi.gate.test.ts
git commit -m "feat(data): wifiGate — short-circuit non-essential sync on cellular"
```

---

## Phase 2 — Rust side: usage IPC

### Task 4: `usage.rs` + `record_tab_usage` command

**Files:**
- Create: `apps/desktop/src-tauri/src/usage.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Create `apps/desktop/src-tauri/src/usage.rs`**

```rust
// Per-tab byte usage relayed from the init-script via Tauri command.
// We accept fire-and-forget invokes from the init-script ~1×/sec/tab,
// debounce in-process by emitting `data://usage` events at most once
// per 500ms per window, and let the chrome webview's data.store
// accumulate the totals.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, Window};

#[derive(Debug, Default)]
struct PendingUsage {
    bytes_used: u64,
    bytes_saved: u64,
    last_emit: Option<Instant>,
}

#[derive(Debug, Default)]
pub struct UsageState {
    inner: Mutex<HashMap<String, PendingUsage>>, // keyed by window_label
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsagePayload {
    pub bytes_used: u64,
    pub bytes_saved: u64,
}

const FLUSH_INTERVAL: Duration = Duration::from_millis(500);

#[tauri::command]
pub async fn record_tab_usage(
    app: AppHandle,
    window: Window,
    state: tauri::State<'_, UsageState>,
    bytes_used: u64,
    bytes_saved: u64,
) -> Result<(), String> {
    let label = window.label().to_string();
    let payload_to_emit = {
        let mut map = state.inner.lock().map_err(|e| e.to_string())?;
        let entry = map.entry(label.clone()).or_default();
        entry.bytes_used += bytes_used;
        entry.bytes_saved += bytes_saved;
        let now = Instant::now();
        let should_emit = entry
            .last_emit
            .map_or(true, |t| now.duration_since(t) >= FLUSH_INTERVAL);
        if should_emit {
            entry.last_emit = Some(now);
            let payload = UsagePayload {
                bytes_used: entry.bytes_used,
                bytes_saved: entry.bytes_saved,
            };
            entry.bytes_used = 0;
            entry.bytes_saved = 0;
            Some(payload)
        } else {
            None
        }
    };

    if let Some(payload) = payload_to_emit {
        // Find the host window for this tab. Tab labels are tab-<id>; the
        // host is the parent profile-* / picker / guest-* window. We just
        // emit globally — the chrome subscribers in every window will
        // hear and accumulate; if that turns out to cross-contaminate
        // across profiles we'll add per-window scoping later.
        let _ = app.emit("data://usage", payload);
    }
    Ok(())
}
```

- [ ] **Step 2: Register in `lib.rs`**

Add the module declaration at the top:

```rust
mod usage;
```

Manage the state in the builder, after the existing `.manage(crate::pin_attempts::PinAttempts::new())`:

```rust
.manage(crate::usage::UsageState::default())
```

Register the command in `invoke_handler!`, alongside the existing entries:

```rust
usage::record_tab_usage,
```

- [ ] **Step 3: Verify Rust compiles**

```
cd apps/desktop/src-tauri && cargo check
```
Expected: clean (pre-existing warnings allowed; no new errors).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/src/usage.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(data): record_tab_usage Tauri command + UsageState"
```

---

### Task 5: `adblock.rs` payload — add `slowMode`

**Files:**
- Modify: `apps/desktop/src-tauri/src/adblock.rs`

- [ ] **Step 1: Add `slow_mode` to `AdblockPayload`**

Edit the struct around line 17:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AdblockPayload {
    pub blocked_hostnames: Vec<String>,
    pub youtube_scriptlets: String,
    pub last_updated: String,
    pub source: AdblockSource,
    #[serde(default)]
    pub slow_mode: bool,
}
```

- [ ] **Step 2: Add `slow_mode` to `bundled_payload` + the build helper**

In `bundled_payload()`:

```rust
fn bundled_payload() -> AdblockPayload {
    AdblockPayload {
        blocked_hostnames: parse_hostnames(BUNDLED_HOSTNAMES),
        youtube_scriptlets: BUNDLED_YOUTUBE_JS.to_string(),
        last_updated: chrono::Utc::now().to_rfc3339(),
        source: AdblockSource::Bundled,
        slow_mode: false,
    }
}
```

In `refresh_from_upstream()`, set `slow_mode: false` on the new payload.

In the test helpers `fixture_payload()` and the cache-corrupted test, add `slow_mode: false` to each `AdblockPayload` literal.

- [ ] **Step 3: Override slow_mode at build time per tab**

Change the signature of `build_init_script` to accept a runtime flag:

```rust
pub fn build_init_script(payload: &AdblockPayload, slow_mode_runtime: bool) -> String {
    let json = serde_json::to_string(&AdblockPayload {
        slow_mode: slow_mode_runtime,
        ..payload.clone()
    }).expect("payload serialisable");
    let engine = engine_js().replace(YT_PLACEHOLDER, &payload.youtube_scriptlets);
    format!("var BAOBAB_ADBLOCK = {};\n{}", json, engine)
}
```

Update the call site in `tabs.rs` (search for `crate::adblock::build_init_script`):

```rust
let payload = crate::adblock::load_payload(&root);
let slow_mode = false; // wired to the connection.store via a future Tauri command; for v1 hardcoded false. We will recompute it in tabs::create_tab from a thread-safe flag in Task 9.
let script = crate::adblock::build_init_script(&payload, slow_mode);
```

- [ ] **Step 4: Update Rust tests**

In the `build_init_tests` mod, update `fixture_payload` to include `slow_mode: false`, and add one test:

```rust
#[test]
fn slow_mode_flag_propagates_into_script() {
    let script = build_init_script(&fixture_payload(), true);
    assert!(script.contains("\"slowMode\":true"));
}
```

- [ ] **Step 5: Run Rust tests, verify pass**

```
cd apps/desktop/src-tauri && cargo test --lib adblock
```
Expected: all adblock tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/adblock.rs apps/desktop/src-tauri/src/tabs.rs
git commit -m "feat(data): AdblockPayload gains slowMode flag, threaded through build_init_script"
```

---

## Phase 3 — Init-script extensions

### Task 6: Lazy-load injection in `engine.js`

**Files:**
- Modify: `apps/desktop/src-tauri/resources/adblock/engine.js`

- [ ] **Step 1: Add lazy-load logic to the existing MutationObserver branch**

Inside the existing MutationObserver callback in `engine.js`, where SCRIPT/IFRAME/IMG are checked, extend:

```js
installMutationObserver(function (muts) {
  for (const m of muts) {
    for (const node of m.addedNodes) {
      if (!(node instanceof Element)) continue;
      const tag = node.tagName;

      // Existing blocked-src removal.
      if (tag === 'SCRIPT' || tag === 'IFRAME' || tag === 'IMG') {
        const src = node.getAttribute('src');
        if (src && isBlocked(src)) { node.remove(); continue; }
      }

      // Lazy-load: set loading="lazy" on every img / iframe that doesn't
      // already have one. Frees CPU + bandwidth on long scroll pages.
      if ((tag === 'IMG' || tag === 'IFRAME') && !node.hasAttribute('loading')) {
        node.setAttribute('loading', 'lazy');
      }
    }
  }
}, { childList: true, subtree: true });
```

- [ ] **Step 2: One-shot pass on existing DOM**

Inside the existing `attach()` function (after `installMutationObserver` resolves the document root), add a single sweep over already-loaded images and iframes:

Look for `installMutationObserver` definition. After observing, but inside the same `attach()` function:

```js
function attach() {
  const target = document.documentElement || document.body;
  if (!target) { setTimeout(attach, 1); return; }
  new MutationObserver(callback).observe(target, options);

  // One-shot sweep: pre-existing img/iframe nodes (parsed before the
  // observer attached) also benefit from lazy-load.
  const sweep = document.querySelectorAll('img:not([loading]), iframe:not([loading])');
  for (const el of sweep) el.setAttribute('loading', 'lazy');
}
```

- [ ] **Step 3: Restart `pnpm tauri dev`**

`engine.js` is `include_str!`'d into the Rust binary, so Vite HMR won't pick this up. Restart the dev process.

- [ ] **Step 4: Manually verify on a heavy page**

Open `https://www.bbc.com/news` in a tab. Open DevTools → Console → run:

```js
[...document.querySelectorAll('img:not([loading])')].length
```

Expected: 0 (every image now has `loading="lazy"`).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/resources/adblock/engine.js
git commit -m "feat(data): lazy-load injection — add loading=lazy to every img/iframe"
```

---

### Task 7: Byte accounting in `engine.js`

**Files:**
- Modify: `apps/desktop/src-tauri/resources/adblock/engine.js`

- [ ] **Step 1: Add a byte counter + flush helper near the top of the IIFE**

After the `BAOBAB_ADBLOCK` check (line ~5):

```js
// Approximate byte counters. Tauri picks them up via record_tab_usage.
// We're a passive observer; numbers underreport (TLS handshake, DNS,
// chunked-encoding overhead are invisible to JS) but useful for trends.
const usage = { used: 0, saved: 0 };

// Conservative per-blocked-resource savings estimate. These are
// 10th-percentile sizes for common ad/tracker payloads; we'd rather
// undercount than overpromise.
const SAVED_BY_KIND = {
  image: 30 * 1024,
  iframe: 150 * 1024,
  script: 60 * 1024,
  other: 25 * 1024,
};

function kindForUrl(url) {
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)(?:[?#]|$)/i.test(url)) return 'image';
  if (/\.(?:js|mjs)(?:[?#]|$)/i.test(url)) return 'script';
  return 'other';
}

function flushUsage() {
  if (usage.used === 0 && usage.saved === 0) return;
  if (!window.__TAURI_INTERNALS__ || !window.__TAURI_INTERNALS__.invoke) return;
  const u = usage.used, s = usage.saved;
  usage.used = 0; usage.saved = 0;
  window.__TAURI_INTERNALS__.invoke('record_tab_usage', { bytesUsed: u, bytesSaved: s }).catch(() => {});
}

setInterval(flushUsage, 1000);
window.addEventListener('beforeunload', flushUsage);
```

- [ ] **Step 2: Extend the fetch hook to count bytes**

Modify the existing fetch hook block:

```js
const origFetch = window.fetch;
window.fetch = function (input, init) {
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (isBlocked(url)) {
    usage.saved += SAVED_BY_KIND[kindForUrl(url)] || SAVED_BY_KIND.other;
    return Promise.reject(new TypeError('Blocked by Baobab ad-blocker'));
  }
  return origFetch.call(window, input, init).then(function (resp) {
    // Best-effort: read Content-Length when present, else 0. Cloning to
    // read the stream would double bandwidth, so we accept the under-
    // report for chunked/streaming responses.
    const cl = resp.headers && resp.headers.get && resp.headers.get('Content-Length');
    if (cl) { const n = parseInt(cl, 10); if (!isNaN(n)) usage.used += n; }
    return resp;
  });
};
```

- [ ] **Step 3: Extend the XHR hook**

Modify the existing XHR send block to count `event.loaded` on `progress` events:

```js
const XhrSend = XMLHttpRequest.prototype.send;
const XhrOpen_orig = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  this.__bbBlocked = isBlocked(url);
  this.__bbKind = kindForUrl(url || '');
  return XhrOpen_orig.apply(this, [method, url, ...rest]);
};
XMLHttpRequest.prototype.send = function (...args) {
  if (this.__bbBlocked) {
    usage.saved += SAVED_BY_KIND[this.__bbKind] || SAVED_BY_KIND.other;
    const self = this;
    setTimeout(function () {
      try {
        const ev = new Event('error');
        self.dispatchEvent(ev);
        if (typeof self.onerror === 'function') self.onerror(ev);
      } catch (_) { /* ignore */ }
    }, 0);
    return;
  }
  // Count actually-downloaded bytes via progress events. `e.loaded` is
  // cumulative, so we track the previous reading and add only the delta.
  this.addEventListener('progress', function (e) {
    if (this.__bbLastLoaded === undefined) this.__bbLastLoaded = 0;
    const delta = (e.loaded || 0) - this.__bbLastLoaded;
    if (delta > 0) usage.used += delta;
    this.__bbLastLoaded = e.loaded || 0;
  });
  return XhrSend.apply(this, args);
};
```

- [ ] **Step 4: Restart `pnpm tauri dev`**

- [ ] **Step 5: Manually verify**

Open a tab to any news site. In DevTools console: `await window.__TAURI_INTERNALS__.invoke('record_tab_usage', { bytesUsed: 1000, bytesSaved: 100 })` — should resolve. The store wiring isn't done yet; Task 11 wires the receiving side. For now just confirm the invoke succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/resources/adblock/engine.js
git commit -m "feat(data): engine.js byte accounting via 1Hz record_tab_usage invoke"
```

---

### Task 8: Slow-mode CSS injection in `engine.js`

**Files:**
- Modify: `apps/desktop/src-tauri/resources/adblock/engine.js`

- [ ] **Step 1: Inject the slow-mode style on attach**

In the existing `attach()` function inside `installMutationObserver`, after the lazy-load sweep:

```js
function attach() {
  const target = document.documentElement || document.body;
  if (!target) { setTimeout(attach, 1); return; }
  new MutationObserver(callback).observe(target, options);

  const sweep = document.querySelectorAll('img:not([loading]), iframe:not([loading])');
  for (const el of sweep) el.setAttribute('loading', 'lazy');

  // Slow-mode CSS: kill animations and font preloads when the host has
  // flagged this page (slow connection OR over budget OR user forced).
  if (BAOBAB_ADBLOCK.slowMode === true) {
    const style = document.createElement('style');
    style.setAttribute('data-baobab', 'slow-mode');
    style.textContent =
      '* { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }' +
      'link[rel="preload"][as="font"] { display: none !important; }' +
      '@font-face { font-display: optional !important; }';
    (document.head || document.documentElement).appendChild(style);
  }
}
```

- [ ] **Step 2: Restart `pnpm tauri dev`**

- [ ] **Step 3: Verify slow-mode is currently OFF**

At this point, `slow_mode_runtime` is still hardcoded `false` in tabs.rs. Load a heavy site — animations should still work normally. The toggle wires up in Task 9.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src-tauri/resources/adblock/engine.js
git commit -m "feat(data): engine.js slow-mode CSS — kill animations + font preloads when flagged"
```

---

### Task 9: Thread slow-mode runtime flag from frontend to tab init

**Files:**
- Modify: `apps/desktop/src-tauri/src/tabs.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

For v1, the slow-mode flag is read at tab-creation time. New tabs opened during slow mode get slow-mode CSS; pages opened before are unaffected (spec calls this out as expected).

- [ ] **Step 1: Add a `SlowModeFlag` shared state**

In `lib.rs`, add at the top:

```rust
use std::sync::atomic::{AtomicBool, Ordering};

pub struct SlowModeFlag(pub AtomicBool);
```

In the builder, after the other `.manage` calls:

```rust
.manage(SlowModeFlag(AtomicBool::new(false)))
```

- [ ] **Step 2: Expose a Tauri command for the frontend to set it**

Add to `lib.rs`:

```rust
#[tauri::command]
fn set_slow_mode(state: tauri::State<'_, SlowModeFlag>, on: bool) -> Result<(), String> {
    state.0.store(on, Ordering::Relaxed);
    Ok(())
}
```

Register in `invoke_handler!`:

```rust
set_slow_mode,
```

- [ ] **Step 3: Read the flag in `tabs.rs::create_tab`**

Replace the `let slow_mode = false;` line from Task 5 with:

```rust
let slow_mode = {
    use std::sync::atomic::Ordering;
    let flag = app.state::<crate::SlowModeFlag>();
    flag.0.load(Ordering::Relaxed)
};
let script = crate::adblock::build_init_script(&payload, slow_mode);
```

- [ ] **Step 4: Verify Rust compiles**

```
cd apps/desktop/src-tauri && cargo check
```

- [ ] **Step 5: Add the TS-side IPC wrapper**

Edit `apps/desktop/src/data/data.api.ts` (this file will be more fully filled in Task 10; create the stub now):

```ts
import { invoke } from '@tauri-apps/api/core'

export const dataApi = {
  setSlowMode: (on: boolean): Promise<void> => invoke('set_slow_mode', { on }),
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/lib.rs apps/desktop/src-tauri/src/tabs.rs apps/desktop/src/data/data.api.ts
git commit -m "feat(data): SlowModeFlag shared state + set_slow_mode IPC"
```

---

## Phase 4 — Frontend event listener + threshold detection

### Task 10: `data.api.ts` — listen for `data://usage` events

**Files:**
- Modify: `apps/desktop/src/data/data.api.ts`

- [ ] **Step 1: Replace the stub with the full listener**

```ts
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useDataStore } from './data.store'

interface UsagePayload {
  bytesUsed: number
  bytesSaved: number
}

let unlisten: UnlistenFn | null = null

export const dataApi = {
  setSlowMode: (on: boolean): Promise<void> => invoke('set_slow_mode', { on }),

  /** Idempotent. Call once per window. */
  initListeners: async (): Promise<void> => {
    if (unlisten) return
    unlisten = await listen<UsagePayload>('data://usage', (event) => {
      const { bytesUsed, bytesSaved } = event.payload
      useDataStore.getState().recordUsage(bytesUsed, bytesSaved)
    })
  },
}
```

- [ ] **Step 2: Wire into `App.tsx` hydrate effect**

In `apps/desktop/src/App.tsx`, find the existing `useEffect` that hydrates tabsStore + downloadsStore:

```ts
useEffect(() => {
  if (!profile) return
  void useTabsStore.getState().hydrate()
  void useTabsStore.getState().initListeners()
  void useDownloadsStore.getState().initListeners()
}, [profile?.id])
```

Extend it:

```ts
useEffect(() => {
  if (!profile) return
  useDataStore.getState().setProfileId(profile.id)
  void useDataStore.getState().hydrate()
  void dataApi.initListeners()
  attachConnectionListeners()
  void useTabsStore.getState().hydrate()
  void useTabsStore.getState().initListeners()
  void useDownloadsStore.getState().initListeners()
}, [profile?.id])
```

Add the imports at the top:

```ts
import { useDataStore } from './data/data.store'
import { dataApi } from './data/data.api'
import { attachConnectionListeners } from './state/connection.store'
```

- [ ] **Step 3: Typecheck**

```
cd apps/desktop && npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/data/data.api.ts apps/desktop/src/App.tsx
git commit -m "feat(data): data.api listener + App hydrate wiring"
```

---

### Task 11: Threshold detector + DataToast

**Files:**
- Create: `apps/desktop/src/data/DataToast.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: Create `DataToast.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useDataStore } from './data.store'
import { useConnectionStore } from '~/state/connection.store'
import { dataApi } from './data.api'

type ToastState = { message: string; key: number } | null

export function DataToast() {
  const percent = useDataStore((s) => s.percentUsedToday())
  const budgetMb = useDataStore((s) => s.budgetMb)
  const [toast, setToast] = useState<ToastState>(null)
  const lastTier = useRef<0 | 80 | 100>(0)

  useEffect(() => {
    const tier = percent >= 100 ? 100 : percent >= 80 ? 80 : 0
    if (tier === lastTier.current) return

    if (tier === 80 && lastTier.current < 80) {
      const remainingMb = Math.max(0, Math.round(budgetMb * 0.2))
      setToast({ message: `${remainingMb} MB left today. Slow mode kicks in at 0.`, key: Date.now() })
    } else if (tier === 100 && lastTier.current < 100) {
      setToast({ message: 'Daily budget reached. Slow mode enabled.', key: Date.now() })
      useConnectionStore.getState().setForced(true)
      void dataApi.setSlowMode(true)
    } else if (tier === 0) {
      // Day rollover: clear forced slow mode, no toast.
      useConnectionStore.getState().setForced(false)
      void dataApi.setSlowMode(false)
    }
    lastTier.current = tier
  }, [percent, budgetMb])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  if (!toast) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px 16px',
        background: 'rgba(28, 24, 20, 0.95)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        color: 'var(--text-primary)',
        borderRadius: 8,
        fontSize: 13,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 9000,
        animation: 'bb-fade-in 220ms ease-out',
      }}
    >
      {toast.message}
    </div>
  )
}
```

- [ ] **Step 2: Mount in `App.tsx`**

Inside the canvas div, alongside the other overlays:

```tsx
<DataToast />
```

Import at top:

```ts
import { DataToast } from './data/DataToast'
```

- [ ] **Step 3: Typecheck**

```
cd apps/desktop && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/data/DataToast.tsx apps/desktop/src/App.tsx
git commit -m "feat(data): DataToast — 80% and 100% threshold notifications"
```

---

## Phase 5 — Chrome UI

### Task 12: `NetworkChip.tsx`

**Files:**
- Create: `apps/desktop/src/chrome/NetworkChip.tsx`
- Modify: `apps/desktop/src/chrome/TabStrip.tsx`

- [ ] **Step 1: Create `NetworkChip.tsx`**

```tsx
import { useConnectionStore } from '~/state/connection.store'

export function NetworkChip() {
  const isSlow = useConnectionStore((s) => s.isSlow)
  const isOffline = useConnectionStore((s) => s.isOffline)
  const effectiveType = useConnectionStore((s) => s.effectiveType)
  const downlink = useConnectionStore((s) => s.downlinkMbps)
  const forced = useConnectionStore((s) => s.slowModeForced)

  if (effectiveType === 'unknown' && downlink === 0 && !isOffline) return null

  let label: string
  let dotColor: string
  let title: string
  if (isOffline) {
    label = 'Offline'
    dotColor = 'var(--text-muted)'
    title = 'No network detected.'
  } else if (forced) {
    label = 'Slow mode'
    dotColor = 'var(--sovereignty-warn)'
    title = 'You enabled slow mode in Settings.'
  } else if (isSlow) {
    const upper = effectiveType.toUpperCase()
    label = `Slow · ${upper}`
    dotColor = 'var(--sovereignty-warn)'
    title = 'Light pages — animations off, fonts deferred.'
  } else {
    label = downlink > 0 ? `Fast · ${Math.round(downlink)} Mbps` : 'Fast'
    dotColor = 'var(--sovereignty-ok)'
    title = 'Full quality.'
  }

  return (
    <span
      title={title}
      data-tauri-drag-region="false"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingInline: 10,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'rgba(28, 24, 20, 0.55)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
      <span>{label}</span>
    </span>
  )
}
```

- [ ] **Step 2: Render `NetworkChip` next to `ResidencyChip` in `TabStrip.tsx`**

Find the existing `<ResidencyChip />` usage and add a sibling:

```tsx
<NetworkChip />
<ResidencyChip />
```

Add import:

```ts
import { NetworkChip } from './NetworkChip'
```

- [ ] **Step 3: Typecheck**

```
cd apps/desktop && npx tsc --noEmit
```

- [ ] **Step 4: Visual sanity check**

The chip should be visible in the tab strip. Throttle the connection in DevTools to Slow 3G and confirm the chip flips to amber.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/chrome/NetworkChip.tsx apps/desktop/src/chrome/TabStrip.tsx
git commit -m "feat(data): NetworkChip — connection state indicator in tab strip"
```

---

### Task 13: `DataSection.tsx`

**Files:**
- Create: `apps/desktop/src/settings/sections/DataSection.tsx`
- Create: `apps/desktop/tests/data.section.test.tsx`
- Modify: `apps/desktop/src/settings/SettingsScreen.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/data.section.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('~/state/persistence', () => {
  const store = new Map<string, unknown>()
  const profileScoped = () => ({
    get: (k: string) => Promise.resolve(store.get(k)),
    set: (k: string, v: unknown) => { store.set(k, v); return Promise.resolve() },
    delete: (k: string) => { store.delete(k); return Promise.resolve() },
  })
  return { profileScoped, persistence: {} }
})

vi.mock('~/data/data.api', () => ({ dataApi: { setSlowMode: vi.fn(async () => undefined) } }))

import { useDataStore } from '~/data/data.store'
import { DataSection } from '~/settings/sections/DataSection'

beforeEach(() => {
  useDataStore.setState({ history: [], budgetMb: 500 })
  useDataStore.getState().setProfileId('p1')
})

describe('DataSection', () => {
  it('shows 0% used and the full budget when there is no usage', () => {
    render(<DataSection />)
    expect(screen.getByText(/0 MB of 500 MB/)).toBeInTheDocument()
  })

  it('renders the used/saved counters reflecting today\'s bucket', () => {
    useDataStore.getState().recordUsage(50 * 1024 * 1024, 10 * 1024 * 1024)
    render(<DataSection />)
    expect(screen.getByText(/50 MB of 500 MB/)).toBeInTheDocument()
    expect(screen.getByText(/saved 10 MB/i)).toBeInTheDocument()
  })

  it('shows 100% when usage equals the budget', () => {
    useDataStore.getState().setBudget(10)
    useDataStore.getState().recordUsage(10 * 1024 * 1024, 0)
    render(<DataSection />)
    expect(screen.getByText(/10 MB of 10 MB/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify failure (module not found)**

- [ ] **Step 3: Create `DataSection.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useDataStore } from '~/data/data.store'
import { useConnectionStore } from '~/state/connection.store'
import { isWifiOnlySync, setWifiOnlySync } from '~/data/wifiGate'
import { dataApi } from '~/data/data.api'

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

export function DataSection() {
  const budgetMb = useDataStore((s) => s.budgetMb)
  const setBudget = useDataStore((s) => s.setBudget)
  const today = useDataStore((s) => s.today())
  const history = useDataStore((s) => s.history)
  const percent = useDataStore((s) => s.percentUsedToday())
  const forced = useConnectionStore((s) => s.slowModeForced)
  const setForced = useConnectionStore((s) => s.setForced)

  const [wifiOnly, setWifiOnlyLocal] = useStateBridged()

  const usedLabel = `${formatMb(today.bytesUsed)} of ${budgetMb} MB`
  const savedLabel = `You've saved ${formatMb(today.bytesSaved)} by blocking ads and lazy loading.`

  return (
    <section style={{ padding: 24, maxWidth: 720 }}>
      <h2 style={{ fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
        Data savings
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, margin: '20px 0' }}>
        <Gauge percent={Math.min(100, Math.round(percent))} />
        <div>
          <div style={{ fontSize: 22, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {usedLabel}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {savedLabel}
          </div>
        </div>
      </div>

      <Row label="Daily budget">
        <input
          type="range"
          min={50}
          max={2000}
          step={50}
          value={budgetMb}
          onChange={(e) => setBudget(Number(e.target.value))}
          style={{ width: 240 }}
        />
        <span style={{ minWidth: 80, color: 'var(--text-secondary)', fontSize: 12 }}>{budgetMb} MB</span>
      </Row>

      <Row label="Only sync on Wi-Fi" hint="Defers history, bookmarks, and the daily digest.">
        <input
          type="checkbox"
          checked={wifiOnly}
          onChange={(e) => { setWifiOnlySync(e.target.checked); setWifiOnlyLocal(e.target.checked) }}
        />
      </Row>

      <Row label="Force slow mode" hint="Act as if connection is 2G regardless. Pages load lighter.">
        <input
          type="checkbox"
          checked={forced}
          onChange={(e) => { setForced(e.target.checked); void dataApi.setSlowMode(e.target.checked) }}
        />
      </Row>

      <Sparkline history={history} />
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>{children}</div>
    </div>
  )
}

function Gauge({ percent }: { percent: number }) {
  const r = 36, c = 2 * Math.PI * r
  const dash = (percent / 100) * c
  const color = percent >= 100 ? 'var(--sovereignty-warn)' : percent >= 80 ? '#e88e2a' : 'var(--accent)'
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
      <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
      <text x="48" y="54" textAnchor="middle" fontSize="18" fill="var(--text-primary)">{percent}%</text>
    </svg>
  )
}

function Sparkline({ history }: { history: { dateKey: string; bytesUsed: number }[] }) {
  const last7 = history.slice(-7)
  if (last7.length === 0) return null
  const max = Math.max(...last7.map((b) => b.bytesUsed), 1)
  return (
    <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Last 7 days</div>
      <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 36 }}>
        {last7.map((b) => (
          <div
            key={b.dateKey}
            title={`${b.dateKey}: ${formatMb(b.bytesUsed)}`}
            style={{ width: 14, height: `${(b.bytesUsed / max) * 100}%`, minHeight: 2, background: 'var(--accent)', opacity: 0.75, borderRadius: 2 }}
          />
        ))}
      </div>
    </div>
  )
}

// Local state mirror for wifiGate's module-level flag so the checkbox can be controlled.
import { useState } from 'react'
function useStateBridged(): [boolean, (b: boolean) => void] {
  const [v, setV] = useState<boolean>(isWifiOnlySync())
  useEffect(() => { setV(isWifiOnlySync()) }, [])
  return [v, setV]
}
```

- [ ] **Step 4: Wire into `SettingsScreen.tsx`**

Find the section list, add a new entry for `'data'`, and render `<DataSection />` when active.

Open `apps/desktop/src/settings/SettingsScreen.tsx`. Identify the section navigation pattern (likely a list of `{id, label}` entries + a switch on the active id). Add:

```ts
{ id: 'data', label: 'Data' }
```

and:

```tsx
{active === 'data' && <DataSection />}
```

Plus the import:

```ts
import { DataSection } from './sections/DataSection'
```

- [ ] **Step 5: Run the test, verify pass**

```
npx vitest run tests/data.section.test.tsx
```
Expected: 3/3 pass.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/settings/sections/DataSection.tsx apps/desktop/tests/data.section.test.tsx apps/desktop/src/settings/SettingsScreen.tsx
git commit -m "feat(data): Data section in Settings — gauge, sparkline, budget, toggles"
```

---

## Phase 6 — Wi-Fi sync gating

### Task 14: Gate digest fetch + history push + bookmarks push

**Files:**
- Modify: `apps/desktop/src/digest/digest.store.ts`
- Modify: `apps/desktop/src/history/history.store.ts`
- Modify: `apps/desktop/src/bookmarks/bookmarks.store.ts`

- [ ] **Step 1: Wrap digest `fetch` action**

Open `apps/desktop/src/digest/digest.store.ts`. Find the `fetch` action and wrap the API call in `gate`:

```ts
import { gate } from '~/data/wifiGate'

// inside the fetch action, where the worker call lives:
const result = await gate(() => digestClient.fetch())
if (result === null) {
  // Deferred until Wi-Fi. Don't set error state; leave existing data.
  return
}
// proceed with `result`
```

- [ ] **Step 2: Wrap history push**

Open `apps/desktop/src/history/history.store.ts`. Find the push/sync action (the function that sends new visits to the worker) and wrap likewise:

```ts
import { gate } from '~/data/wifiGate'

const r = await gate(() => historyClient.push(visit))
if (r === null) {
  // Queue locally — visit stays in the unsynced queue.
  return
}
```

If the existing code doesn't have a local queue, the gate just no-ops on cellular and the worker simply doesn't get this visit. Acceptable for v1.

- [ ] **Step 3: Wrap bookmarks push**

Same pattern in `apps/desktop/src/bookmarks/bookmarks.store.ts`.

- [ ] **Step 4: Typecheck**

```
cd apps/desktop && npx tsc --noEmit
```

- [ ] **Step 5: Run all tests**

```
npx vitest run
```
Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/digest/digest.store.ts apps/desktop/src/history/history.store.ts apps/desktop/src/bookmarks/bookmarks.store.ts
git commit -m "feat(data): wifiGate applied to digest/history/bookmarks sync"
```

---

## Phase 7 — Verification

### Task 15: Manual smoke + acceptance sweep

**Files:** — (verification only)

- [ ] **Step 1: Cold-start verification**

Start fresh: `pnpm tauri dev`. After the picker resolves to a profile:
- NetworkChip is visible in the tab strip with current connection state
- No console errors on load

- [ ] **Step 2: Lazy-load check**

Open `https://www.bbc.com/news`. In DevTools console:

```js
const total = document.querySelectorAll('img').length
const lazy = document.querySelectorAll('img[loading="lazy"]').length
console.log({ total, lazy })
```

Expected: `lazy / total >= 0.95` (some `<img>` elements may be created by scripts after our sweep; >95% is acceptable).

- [ ] **Step 3: Slow-mode CSS verification**

Settings → Data → toggle "Force slow mode" ON. Open a new tab to `https://www.cnn.com`. In DevTools:

```js
document.querySelector('style[data-baobab="slow-mode"]') !== null
```

Expected: `true`. Visually: hover transitions on the page should be near-instant (no fade).

- [ ] **Step 4: Byte accounting**

Settings → Data → note the "0 MB of 500 MB" gauge. Browse to a few sites. After ~30 seconds, gauge should tick upward.

- [ ] **Step 5: Threshold toasts**

Settings → Data → set daily budget to 1 MB. Open any news site. Within seconds:
- 80% toast appears
- 100% toast appears + "Force slow mode" checkbox flips ON automatically
- NetworkChip shows "Slow mode"

Open another new tab → slow-mode CSS is injected on that tab.

- [ ] **Step 6: Wi-Fi-only sync**

Settings → Data → confirm "Only sync on Wi-Fi" is ON by default. In DevTools, force a cellular connection state:

```js
Object.defineProperty(navigator, 'connection', { value: { effectiveType: '3g', type: 'cellular', downlink: 1, addEventListener: () => {}, removeEventListener: () => {} } })
window.dispatchEvent(new Event('online'))
```

Reload the chrome window. The Continent Today digest should NOT auto-fetch. Toggle the setting off → digest fetches.

- [ ] **Step 7: Day rollover (light test)**

Set a budget of 50 MB. Use up some of it. Set system clock forward one day (or wait until tomorrow). Reload — the gauge should reset to 0 today's bucket, history should now have one entry for yesterday.

- [ ] **Step 8: Full typecheck + test suite**

```
cd apps/desktop && npx tsc --noEmit && npx vitest run
```

Expected: clean typecheck, all tests passing.

- [ ] **Step 9: Final commit + push**

If any smoke fixes landed:

```bash
git add -p
git commit -m "fix(data): manual-smoke fixes for data savings suite"
```

Push:

```bash
git push
```

- [ ] **Step 10: Update memory progress_state.md**

Edit `~/.claude/projects/C--dev-baobab/memory/progress_state.md`. Add a new section "Latest work — Data Savings Suite" describing what shipped, with the HEAD commit reference.
