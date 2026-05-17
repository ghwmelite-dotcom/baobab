import { useEffect } from 'react'
import { ipcTabReload } from '~/ipc/tabs'
import { useTabsStore } from '~/state/tabs.store'
import { useAiStore } from '~/ai/ai.store'
import { useSettingsStore } from '~/settings/settings.store'
import { useTranslateStore } from '~/translate/translate.store'
import { useHistoryStore } from '~/history/history.store'
import { useDownloadsStore } from '~/downloads/downloads.store'
import { useBookmarksStore } from '~/bookmarks/bookmarks.store'
import { OS } from '~/platform/os'

const NEW_TAB_DEFAULT_URL = 'about:blank'

function isPrimaryMod(e: KeyboardEvent): boolean {
  return OS === 'macos' ? e.metaKey : e.ctrlKey
}

export function useChromeShortcuts(): void {
  useEffect(() => {
    const isMac = OS === 'macos'
    const onKey = (e: KeyboardEvent) => {
      const tabsStore = useTabsStore.getState()
      const primary = isPrimaryMod(e)
      const key = e.key.toLowerCase()

      // ── Shortcuts that DON'T use the primary modifier ─────────────────
      // These are handled BEFORE the primary-mod gate so they work on
      // both Windows (Ctrl) and macOS (Cmd) consistently.

      // F5 / Ctrl+F5 → reload. Ctrl+F5 is the Windows hard-reload convention;
      // we intercept it to STOP WebView2 from reloading the chrome window
      // itself (which dumps the user into "Loading profile…" purgatory).
      if (e.key === 'F5') {
        e.preventDefault()
        reloadActive(tabsStore)
        return
      }

      // Tab switching: ALWAYS Ctrl+Tab, even on Mac. Cmd+Tab is the
      // macOS app switcher (OS-level) — never reaches us. Browsers on
      // Mac all use Ctrl+Tab for next tab.
      if (e.ctrlKey && !e.metaKey && e.key === 'Tab') {
        e.preventDefault()
        const { tabs, activeId } = tabsStore
        if (tabs.length === 0) return
        const idx = tabs.findIndex((t) => t.id === activeId)
        const dir = e.shiftKey ? -1 : 1
        const nextIdx = (idx + dir + tabs.length) % tabs.length
        const next = tabs[nextIdx]
        if (next) tabsStore.setActive(next.id)
        return
      }

      // Back / Forward — multiple conventions:
      //  - Alt + Left/Right (Win convention, works on Mac too with Option)
      //  - Cmd + [ / Cmd + ] (Safari convention; Mac users expect these)
      if (!primary && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        navHistory(tabsStore, e.key === 'ArrowLeft' ? 'back' : 'forward')
        return
      }
      if (isMac && primary && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        navHistory(tabsStore, e.key === '[' ? 'back' : 'forward')
        return
      }

      if (!primary) return

      // ── From here on: primary modifier (Cmd on Mac, Ctrl on Win/Linux)
      // is required. Avoid macOS OS-level bindings: Cmd+H (hide), Cmd+M
      // (minimize), Cmd+Q (quit), Cmd+Space (Spotlight), Cmd+Tab (app
      // switcher). All of those are intercepted by the OS before they
      // reach us — using them as shortcuts would silently fail on Mac.

      // Ctrl/Cmd + T → new tab
      if (key === 't' && !e.shiftKey) {
        e.preventDefault()
        void tabsStore.openTab(NEW_TAB_DEFAULT_URL)
        return
      }
      // Ctrl/Cmd + Shift + N → new private tab
      if (key === 'n' && e.shiftKey) {
        e.preventDefault()
        void tabsStore.openIncognitoTab(NEW_TAB_DEFAULT_URL)
        return
      }
      // Ctrl/Cmd + W → close active tab
      if (key === 'w' && !e.shiftKey) {
        e.preventDefault()
        if (tabsStore.activeId) void tabsStore.closeTab(tabsStore.activeId)
        return
      }
      // Ctrl/Cmd + 1..8 → switch to tab N; 9 → last tab
      if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
        e.preventDefault()
        const { tabs } = tabsStore
        if (tabs.length === 0) return
        const n = Number(e.key)
        const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]
        if (target) tabsStore.setActive(target.id)
        return
      }

      // Ctrl/Cmd + R → reload active tab.
      // Ctrl/Cmd + Shift + R → hard reload (same handler — WebView2 manages
      // cache itself, the important thing is preventing the chrome reload).
      if (key === 'r') {
        e.preventDefault()
        reloadActive(tabsStore)
        return
      }

      // Side panels
      if (e.key === '\\') {
        e.preventDefault()
        useAiStore.getState().toggleSidebar()
        return
      }
      if (e.key === ',') {
        e.preventDefault()
        useSettingsStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + Shift + T → Translation Pad (replacing "reopen closed
      // tab" convention because cross-language work is a core diff for us)
      if (key === 't' && e.shiftKey) {
        e.preventDefault()
        useTranslateStore.getState().toggle()
        return
      }

      // History: Cmd+H is taken by macOS "Hide app" — use Cmd+Y on Mac
      // (Chrome / Safari convention); Ctrl+H elsewhere.
      const historyKey = isMac ? 'y' : 'h'
      if (key === historyKey && !e.shiftKey) {
        e.preventDefault()
        useHistoryStore.getState().toggle()
        return
      }

      // Downloads: Cmd+Shift+J on Mac matches Chrome; Ctrl+J on Win/Linux.
      if (isMac ? (key === 'j' && e.shiftKey) : (key === 'j' && !e.shiftKey)) {
        e.preventDefault()
        useDownloadsStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + Shift + O → bookmarks panel
      if (key === 'o' && e.shiftKey) {
        e.preventDefault()
        useBookmarksStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + D → bookmark the active tab
      if (key === 'd' && !e.shiftKey) {
        e.preventDefault()
        const { activeId, tabs } = tabsStore
        const active = tabs.find((t) => t.id === activeId)
        if (active && active.url && active.url !== 'about:blank') {
          void useBookmarksStore.getState().add(active.url, active.title ?? active.url)
        }
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function reloadActive(tabsStore: ReturnType<typeof useTabsStore.getState>): void {
  const { activeId, tabs } = tabsStore
  const active = tabs.find((t) => t.id === activeId)
  if (active && active.url && active.url !== 'about:blank') {
    void ipcTabReload(active.id)
  }
}

function navHistory(
  tabsStore: ReturnType<typeof useTabsStore.getState>,
  dir: 'back' | 'forward',
): void {
  const { activeId, goBack, goForward } = tabsStore
  if (!activeId) return
  if (dir === 'back') void goBack(activeId)
  else void goForward(activeId)
}
