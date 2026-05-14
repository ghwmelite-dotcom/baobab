import { useEffect } from 'react'
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
    const onKey = (e: KeyboardEvent) => {
      const tabsStore = useTabsStore.getState()
      const primary = isPrimaryMod(e)

      // ── F5 (reload, no modifier required on any OS) ────────────────────
      if (e.key === 'F5' && !primary) {
        e.preventDefault()
        const { activeId, tabs, navigate } = tabsStore
        const active = tabs.find((t) => t.id === activeId)
        if (active && active.url && active.url !== 'about:blank') {
          void navigate(active.id, active.url)
        }
        return
      }

      // ── Alt + Left / Right (back / forward, no primary mod) ────────────
      if (!primary && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const { activeId, goBack, goForward } = tabsStore
        if (activeId) {
          if (e.key === 'ArrowLeft') void goBack(activeId)
          else void goForward(activeId)
        }
        return
      }

      if (!primary) return

      // ── Tab management ────────────────────────────────────────────────
      // Ctrl/Cmd + T → new tab
      if (e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        void tabsStore.openTab(NEW_TAB_DEFAULT_URL)
        return
      }
      // Ctrl/Cmd + Shift + N → new private tab
      if (e.key.toLowerCase() === 'n' && e.shiftKey) {
        e.preventDefault()
        void tabsStore.openIncognitoTab(NEW_TAB_DEFAULT_URL)
        return
      }
      // Ctrl/Cmd + W → close active tab
      if (e.key.toLowerCase() === 'w' && !e.shiftKey) {
        e.preventDefault()
        if (tabsStore.activeId) void tabsStore.closeTab(tabsStore.activeId)
        return
      }
      // Ctrl + Tab → next, Ctrl + Shift + Tab → previous
      if (e.key === 'Tab') {
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
      // Ctrl/Cmd + 1..8 → switch to tab N (1-indexed). Ctrl/Cmd + 9 → last tab.
      if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
        e.preventDefault()
        const { tabs } = tabsStore
        if (tabs.length === 0) return
        const n = Number(e.key)
        const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1]
        if (target) tabsStore.setActive(target.id)
        return
      }

      // ── Navigation ────────────────────────────────────────────────────
      // Ctrl/Cmd + R → reload active tab
      if (e.key.toLowerCase() === 'r' && !e.shiftKey) {
        e.preventDefault()
        const { activeId, tabs, navigate } = tabsStore
        const active = tabs.find((t) => t.id === activeId)
        if (active && active.url && active.url !== 'about:blank') {
          void navigate(active.id, active.url)
        }
        return
      }

      // ── Side panels ───────────────────────────────────────────────────
      // Ctrl/Cmd + \ → toggle AI sidebar
      if (e.key === '\\') {
        e.preventDefault()
        useAiStore.getState().toggleSidebar()
        return
      }
      // Ctrl/Cmd + , → toggle settings overlay
      if (e.key === ',') {
        e.preventDefault()
        useSettingsStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + Shift + T → toggle Translation Pad. Browsers historically
      // bind this to "reopen closed tab"; Baobab chooses translation instead
      // because cross-language work is one of the core differentiators.
      if (e.key.toLowerCase() === 't' && e.shiftKey) {
        e.preventDefault()
        useTranslateStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + H → history panel
      if (e.key.toLowerCase() === 'h' && !e.shiftKey) {
        e.preventDefault()
        useHistoryStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + J → downloads panel
      if (e.key.toLowerCase() === 'j' && !e.shiftKey) {
        e.preventDefault()
        useDownloadsStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + Shift + O → bookmarks panel (Ctrl+B is reserved for the
      // bookmarks BAR convention in some browsers; we don't have a separate
      // bar so Shift+O reaches the panel directly)
      if (e.key.toLowerCase() === 'o' && e.shiftKey) {
        e.preventDefault()
        useBookmarksStore.getState().toggle()
        return
      }
      // Ctrl/Cmd + D → bookmark the active tab
      if (e.key.toLowerCase() === 'd' && !e.shiftKey) {
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
