# Real Tab Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "navigate-to-same-URL" hack used by the refresh button, F5, and Ctrl/Cmd+R with a real `webview.eval("location.reload()")` call so the active tab reloads with proper browser semantics (cache, unload events, etc.).

**Architecture:** New `tab_reload` Tauri command (mirrors the existing `tab_go_back` / `tab_go_forward` shape). New `ipcTabReload` TS wrapper. Three caller sites (`Omnibar.tsx#reload`, `useChromeShortcuts.ts#reloadActive`, and one `invoke_handler` registration in `lib.rs`) get the one-line swap from `navigate(...)` to `ipcTabReload(...)`.

**Tech Stack:** Rust (Tauri 2 webview API), TypeScript (existing IPC wrapper pattern), Vitest.

**Spec:** `docs/superpowers/specs/2026-05-16-tab-reload-design.md`

---

## File Structure

### Modified Rust files
- `apps/desktop/src-tauri/src/tabs.rs` — add `tab_reload` async command after the existing `tab_go_forward`.
- `apps/desktop/src-tauri/src/lib.rs` — register `tabs::tab_reload` in `invoke_handler`.

### Modified frontend files
- `apps/desktop/src/ipc/tabs.ts` — add `ipcTabReload(tabId)` wrapper.
- `apps/desktop/src/chrome/Omnibar.tsx` — `reload()` uses `ipcTabReload` instead of `navigate`.
- `apps/desktop/src/chrome/useChromeShortcuts.ts` — `reloadActive()` uses `ipcTabReload` instead of `navigate`.

### New test files
- `apps/desktop/tests/ipc.tabs.test.ts` — single test that `ipcTabReload(id)` invokes `tab_reload` with the right payload.

---

## Task 1: Rust `tab_reload` command

**Files:**
- Modify: `apps/desktop/src-tauri/src/tabs.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Append `tab_reload` command to `tabs.rs`**

Read `apps/desktop/src-tauri/src/tabs.rs` and find the existing `tab_go_forward` command (it's the last `#[tauri::command]` in the file before `list_tabs`). Add the new command right after it, before `list_tabs`:

```rust
// Fire-and-forget reload via webview.eval. WebView2 honours its own
// cache rules, so this behaves like a normal browser refresh — no
// cache-skip semantics (that would be a separate hard-reload command).
#[tauri::command]
pub async fn tab_reload(app: AppHandle, tab_id: String) -> Result<(), String> {
    let label = tab_label(&tab_id);
    let wv = app
        .get_webview(&label)
        .ok_or_else(|| format!("webview {label} not found"))?;
    wv.eval("location.reload()").map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Register `tab_reload` in `lib.rs#invoke_handler`**

In `apps/desktop/src-tauri/src/lib.rs`, find the `tauri::generate_handler![...]` macro call. It currently lists `tabs::tab_go_back, tabs::tab_go_forward, ...`. Add `tabs::tab_reload,` right after `tabs::tab_go_forward,`:

```rust
tabs::tab_go_back,
tabs::tab_go_forward,
tabs::tab_reload,
```

- [ ] **Step 3: Build to verify**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo build
```

Expected: build clean. The only existing warnings are the pre-existing `link_baobab_account` / `unlink_baobab_account` dead-code notices.

- [ ] **Step 4: Run the full Rust test suite to confirm no regressions**

```bash
cd C:\dev\baobab\apps\desktop\src-tauri && cargo test
```

Expected: `57 passed; 0 failed` (same count as before — this task adds a thin command shim that mirrors existing `tab_go_back`/`tab_go_forward` and has no inline tests, by the same convention).

- [ ] **Step 5: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src-tauri/src/tabs.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(tabs): tab_reload command via webview.eval('location.reload()')"
```

---

## Task 2: TS `ipcTabReload` wrapper + test

**Files:**
- Modify: `apps/desktop/src/ipc/tabs.ts`
- Create: `apps/desktop/tests/ipc.tabs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/ipc.tabs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'profile-test' }),
}))

import { invoke } from '@tauri-apps/api/core'
import { ipcTabReload } from '~/ipc/tabs'

const invokeMock = invoke as ReturnType<typeof vi.fn>

beforeEach(() => {
  invokeMock.mockReset()
})

describe('ipcTabReload', () => {
  it('invokes tab_reload with the given tabId', async () => {
    invokeMock.mockResolvedValue(undefined)
    await ipcTabReload('abc')
    expect(invokeMock).toHaveBeenCalledWith('tab_reload', { tabId: 'abc' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/ipc.tabs.test.ts
```

Expected: FAIL with "Cannot find module '~/ipc/tabs'" path resolves, but the import `ipcTabReload` does not exist — so the failure will look like "ipcTabReload is not a function" or "is not exported from this module".

- [ ] **Step 3: Add the wrapper to `ipc/tabs.ts`**

Read `apps/desktop/src/ipc/tabs.ts` first to confirm the existing structure (it already exports `ipcCreateTab`, `ipcShowTab`, `ipcHideTab`, `ipcHideAllTabs`, `ipcCloseTab`, `ipcNavigateTab`, `ipcListTabs`, `ipcTabGoBack`, `ipcTabGoForward`). Append the new wrapper at the bottom of the file in line with the existing tab-scoped wrappers that do NOT take `windowLabel`:

```ts
export const ipcTabReload = (tabId: string) => invoke<void>('tab_reload', { tabId })
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd C:\dev\baobab\apps\desktop && npx vitest run tests/ipc.tabs.test.ts
```

Expected: `Test Files  1 passed` / `Tests  1 passed`.

- [ ] **Step 5: Run the full TS test suite to confirm no regressions**

```bash
cd C:\dev\baobab\apps\desktop && npm test
```

Expected: `Test Files  35 passed (35)` / `Tests  159 passed (159)` (the previous green of 34/158 plus one new test in `ipc.tabs.test.ts`).

- [ ] **Step 6: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/ipc/tabs.ts apps/desktop/tests/ipc.tabs.test.ts
git commit -m "feat(ipc): ipcTabReload TS wrapper for tab_reload"
```

---

## Task 3: Swap callers — Omnibar refresh button

**Files:**
- Modify: `apps/desktop/src/chrome/Omnibar.tsx`

- [ ] **Step 1: Read the current `Omnibar.tsx` imports**

Open `apps/desktop/src/chrome/Omnibar.tsx`. Find the import block at the top — it imports several functions from `~/ipc/tabs`. Confirm the exact existing import line so we can extend it cleanly.

- [ ] **Step 2: Add `ipcTabReload` to the existing `~/ipc/tabs` import**

Find the import like `import { ipcCreateTab, ipcNavigateTab, ... } from '~/ipc/tabs'` (it will already include several wrappers). Add `ipcTabReload` to that import list, alphabetically with the others if the existing list is sorted. If the project doesn't sort, just append.

- [ ] **Step 3: Replace the `reload` function body**

Find the existing function near line 198:

```ts
const reload = () => {
  if (activeId && activeTab?.url && activeTab.url !== 'about:blank') {
    void navigate(activeId, activeTab.url)
  }
}
```

Replace with:

```ts
const reload = () => {
  if (activeId && activeTab?.url && activeTab.url !== 'about:blank') {
    void ipcTabReload(activeId)
  }
}
```

The guard stays — refresh on `about:blank` / NTP still no-ops as today.

- [ ] **Step 4: Verify typecheck**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck
```

Expected: clean. If TypeScript complains about an unused `navigate` import, leave it alone for now — `navigate` is still used elsewhere in this file (Omnibar uses `navigate` for the omnibar URL submit too). It's only the `reload` function that swaps callers.

- [ ] **Step 5: Run the full test suite**

```bash
cd C:\dev\baobab\apps\desktop && npm test
```

Expected: still 35 files, 159 tests passing. No test directly hits `Omnibar.reload()`, so the existing suite stays green; manual verification covers it.

- [ ] **Step 6: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/chrome/Omnibar.tsx
git commit -m "fix(omnibar): refresh button calls ipcTabReload instead of re-navigating"
```

---

## Task 4: Swap callers — F5 / Ctrl+R keyboard shortcuts

**Files:**
- Modify: `apps/desktop/src/chrome/useChromeShortcuts.ts`

- [ ] **Step 1: Add `ipcTabReload` import**

Open `apps/desktop/src/chrome/useChromeShortcuts.ts`. Find the existing `~/ipc/tabs` import (it currently imports `ipcTabGoBack`, `ipcTabGoForward`, etc.). Add `ipcTabReload` to that import.

- [ ] **Step 2: Replace `reloadActive` body**

Find the function near line 165:

```ts
function reloadActive(tabsStore: ReturnType<typeof useTabsStore.getState>): void {
  const { activeId, tabs, navigate } = tabsStore
  const active = tabs.find((t) => t.id === activeId)
  if (active && active.url && active.url !== 'about:blank') {
    void navigate(active.id, active.url)
  }
}
```

Replace with:

```ts
function reloadActive(tabsStore: ReturnType<typeof useTabsStore.getState>): void {
  const { activeId, tabs } = tabsStore
  const active = tabs.find((t) => t.id === activeId)
  if (active && active.url && active.url !== 'about:blank') {
    void ipcTabReload(active.id)
  }
}
```

The `navigate` destructure is dropped from this helper since we no longer call the store action — the IPC bypasses the store entirely (matching how `ipcTabGoBack` / `ipcTabGoForward` are called from this same file's `navHistory` helper).

- [ ] **Step 3: Verify typecheck**

```bash
cd C:\dev\baobab\apps\desktop && npm run typecheck
```

Expected: clean.

- [ ] **Step 4: Run the full test suite**

```bash
cd C:\dev\baobab\apps\desktop && npm test
```

Expected: 35 files, 159 tests passing.

- [ ] **Step 5: Commit**

```bash
cd C:\dev\baobab
git add apps/desktop/src/chrome/useChromeShortcuts.ts
git commit -m "fix(shortcuts): F5 and Ctrl/Cmd+R call ipcTabReload instead of re-navigating"
```

---

## Task 5: Manual integration verification

**Files:** None — runtime verification only.

- [ ] **Step 1: Boot the dev build**

The dev server may already be running from earlier in this session. If not:

```bash
cd C:\dev\baobab\apps\desktop && npm run tauri dev
```

If it's already running, Vite will hot-reload the frontend changes. The Rust change requires a recompile (Tauri's watcher in `src-tauri` triggers it automatically; if the running exe holds a file handle, you may need to kill it and re-run).

- [ ] **Step 2: Walk through the manual checks**

In any profile window:

- [ ] Open `https://github.com` (or any real page). Click the refresh icon in the omnibar. Page reloads — same URL, content refetched.
- [ ] On the same page, press `F5`. Page reloads.
- [ ] On the same page, press `Ctrl+R` (or `Cmd+R` on macOS). Page reloads.
- [ ] Open a new tab (`Ctrl+T`) — it lands on the NTP / `about:blank`. The refresh icon should be visibly disabled (greyed out). Pressing `F5` and `Ctrl+R` on this tab should no-op (no error, nothing happens).
- [ ] Scroll a long page (e.g., a Wikipedia article) part-way down. Click refresh. Page reloads and resets scroll to top — this is correct `location.reload()` behaviour; scroll-preservation is explicitly out of scope per spec.

- [ ] **Step 3: Final commit (manual-verification marker)**

If everything passed:

```bash
cd C:\dev\baobab
git commit --allow-empty -m "feat(reload): tab_reload v1 manually verified

Refresh button, F5, and Ctrl/Cmd+R all trigger a real
webview.eval('location.reload()'), honouring HTTP cache.
about:blank / NTP correctly stays disabled. Acceptance criteria
from docs/superpowers/specs/2026-05-16-tab-reload-design.md
verified end-to-end on Windows dev build."
```

If anything failed, do NOT commit the marker — fix forward and re-run the manual check.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ `tab_reload` command exists in `tabs.rs` and is registered in `lib.rs#invoke_handler` → Task 1
- ✅ `ipcTabReload` wrapper exists in `ipc/tabs.ts` → Task 2
- ✅ `Omnibar.tsx#reload` calls `ipcTabReload(activeId)` → Task 3
- ✅ `useChromeShortcuts.ts#reloadActive` calls `ipcTabReload(active.id)` → Task 4
- ✅ `ipc.tabs.test.ts` exists with passing wrapper test → Task 2
- ✅ Full test suite still green → asserted after each task
- ✅ Manual verification → Task 5

**Type / signature consistency:**
- `tab_reload(app, tab_id: String) -> Result<(), String>` (Rust) ↔ `invoke('tab_reload', { tabId })` (TS) — Tauri 2 auto-converts JS camelCase keys to Rust snake_case param names ✓
- `ipcTabReload(tabId: string)` signature is consistent across Omnibar and useChromeShortcuts callers ✓
- Existing wrappers like `ipcTabGoBack`/`ipcTabGoForward` already follow the same `(tabId: string) => invoke<void>('tab_go_back', { tabId })` pattern — `ipcTabReload` matches that exactly ✓

**No placeholders, no "implement later" steps — every code change has runnable code shown.**
