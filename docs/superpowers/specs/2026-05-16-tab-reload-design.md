# Real Tab Reload — Design

**Status:** draft (awaiting user review)
**Date:** 2026-05-16
**Branch context:** Refresh button + F5 + Ctrl/Cmd+R all currently use a "navigate-to-same-URL" hack via `navigate_tab`. This causes a full re-navigation instead of a proper browser reload — wrong cache semantics, no `unload` event, scroll position lost, can't reload `about:blank` (intentionally). Replacing with a true `location.reload()` call.

## Goal

The refresh button, F5, and Ctrl/Cmd+R fire a real browser reload (`location.reload()`) on the active tab's WebView2 instance — same semantics a user would get clicking refresh in any other browser.

## Non-goals

- Hard reload / cache-skip variant (`Ctrl+Shift+R` / `location.reload(true)`) — out of scope; user explicitly chose "real reload only".
- Scroll-position preservation — out of scope.
- Reloading `about:blank` / NTP — guard stays as today (button disabled, shortcuts no-op).
- A "stop loading" button — separate ask if it ever comes up.

## Key decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Mechanism | `webview.eval("location.reload()")` via new Tauri command | Matches existing `tab_go_back` / `tab_go_forward` pattern. Uses the WebView2's own reload semantics without us reimplementing cache rules. |
| Command name | `tab_reload` | Consistent with `tab_go_back` / `tab_go_forward` naming. |
| New file vs extend existing | Extend `tabs.rs` + `ipc/tabs.ts` + `Omnibar.tsx` + `useChromeShortcuts.ts` | Pure additive change to existing modules; no new files needed. |

## Architecture

### Rust side — `apps/desktop/src-tauri/src/tabs.rs`

Add a new command after the existing `tab_go_forward`:

```rust
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

Register in `lib.rs` invoke_handler alongside `tab_go_back` / `tab_go_forward`:

```rust
tabs::tab_reload,
```

### Frontend side

**`apps/desktop/src/ipc/tabs.ts`** — add wrapper next to the existing nav wrappers:

```ts
export const ipcTabReload = (tabId: string) => invoke<void>('tab_reload', { tabId })
```

**`apps/desktop/src/chrome/Omnibar.tsx`** — replace the `reload` body (currently line ~198):

```ts
const reload = () => {
  if (activeId && activeTab?.url && activeTab.url !== 'about:blank') {
    void ipcTabReload(activeId)
  }
}
```

Add the `ipcTabReload` import at the top alongside the existing `ipc/tabs` imports.

**`apps/desktop/src/chrome/useChromeShortcuts.ts`** — replace `reloadActive` (currently line ~165):

```ts
function reloadActive(tabsStore: ReturnType<typeof useTabsStore.getState>): void {
  const { activeId, tabs } = tabsStore
  const active = tabs.find((t) => t.id === activeId)
  if (active && active.url && active.url !== 'about:blank') {
    void ipcTabReload(active.id)
  }
}
```

(Drops the `navigate` destructure since we no longer call it from this helper.)

### Capability

`tab_reload` is a regular Tauri command, allowed for any window in the existing capabilities allowlist (`profile-*`, `picker`, `guest-*`). No capability changes needed.

## Data flow

```
User clicks refresh icon (or presses F5 / Ctrl+R)
  → Omnibar.reload() / useChromeShortcuts.reloadActive() guard against about:blank
  → ipcTabReload(activeId)
  → invoke('tab_reload', { tabId: activeId })
  → Rust: app.get_webview('tab-{id}').eval('location.reload()')
  → WebView2 issues its own reload (honours HTTP cache, fires unload, etc.)
```

No tab-store mutations, no event emits — the existing `on_page_load(Finished)` hook in `create_tab` will fire when the reload finishes and update the title/url cache as it does today.

## Error handling

- **Tab missing on Rust side** (e.g., webview was already closed): returns `Err("webview tab-{id} not found")`. Frontend swallows with `.catch(() => undefined)` style (or just ignores since reload is fire-and-forget). Acceptable — the missing-webview case shouldn't happen because the UI button is disabled when there's no active tab.
- **`eval` fails**: returns `Err(reason)`. Frontend swallows. The eval can fail if the webview is mid-navigation; the user can press refresh again.
- **`about:blank` / NTP**: caught client-side; no IPC fires. Matches today's behaviour.

## Testing

### Rust
No inline unit test — matches the existing pattern for `tab_go_back` / `tab_go_forward` (which both call `wv.eval(...)` and aren't unit tested). The whole body is delegating to WebView2; meaningful coverage requires a live webview.

### TS
Add a new test file `apps/desktop/tests/ipc.tabs.test.ts` (no IPC test file currently exists, so this becomes the home for any future IPC-wrapper tests):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'profile-test' }) }))
import { invoke } from '@tauri-apps/api/core'
import { ipcTabReload } from '~/ipc/tabs'

const invokeMock = invoke as ReturnType<typeof vi.fn>
beforeEach(() => { invokeMock.mockReset() })

describe('ipcTabReload', () => {
  it('invokes tab_reload with tabId', async () => {
    invokeMock.mockResolvedValue(undefined)
    await ipcTabReload('abc')
    expect(invokeMock).toHaveBeenCalledWith('tab_reload', { tabId: 'abc' })
  })
})
```

### Manual
- Open a page (e.g. github.com) → click refresh icon → page reloads from network/cache as expected
- Press F5 → same
- Press Ctrl+R (Cmd+R on macOS) → same
- Open a new tab (about:blank / NTP) → refresh icon is greyed out; pressing F5 does nothing
- Reload while scrolled down a long page → page reloads to top (this is correct `location.reload()` behaviour; scroll-preservation is out of scope)

## Acceptance criteria

- ✅ `tab_reload` IPC command exists in `tabs.rs` and is registered in `lib.rs#invoke_handler`
- ✅ `ipcTabReload` wrapper exists in `ipc/tabs.ts`
- ✅ `Omnibar.tsx#reload` calls `ipcTabReload(activeId)` instead of `navigate(...)`
- ✅ `useChromeShortcuts.ts#reloadActive` calls `ipcTabReload(active.id)` instead of `navigate(...)`
- ✅ `ipc.tabs.test.ts` exists and passes for the new wrapper
- ✅ Full test suite still green
- ✅ Manual: refresh icon, F5, and Ctrl+R all trigger a real reload on any non-NTP tab

## Open questions

None.
