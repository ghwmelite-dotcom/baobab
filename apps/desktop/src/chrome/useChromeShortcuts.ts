import { useEffect } from 'react'
import { useTabsStore } from '~/state/tabs.store'
import { useAiStore } from '~/ai/ai.store'
import { OS } from '~/platform/os'

const NEW_TAB_DEFAULT_URL = 'about:blank'

function isPrimaryMod(e: KeyboardEvent): boolean {
  return OS === 'macos' ? e.metaKey : e.ctrlKey
}

export function useChromeShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isPrimaryMod(e)) return
      const store = useTabsStore.getState()

      // Ctrl/Cmd + T → new tab
      if (e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault()
        void store.openTab(NEW_TAB_DEFAULT_URL)
        return
      }
      // Ctrl/Cmd + W → close active tab
      if (e.key.toLowerCase() === 'w' && !e.shiftKey) {
        e.preventDefault()
        if (store.activeId) void store.closeTab(store.activeId)
        return
      }
      // Ctrl + Tab → next, Ctrl + Shift + Tab → previous
      if (e.key === 'Tab') {
        e.preventDefault()
        const { tabs, activeId } = store
        if (tabs.length === 0) return
        const idx = tabs.findIndex((t) => t.id === activeId)
        const dir = e.shiftKey ? -1 : 1
        const nextIdx = (idx + dir + tabs.length) % tabs.length
        const next = tabs[nextIdx]
        if (next) store.setActive(next.id)
        return
      }
      // Ctrl/Cmd + \ → toggle AI sidebar
      if (e.key === '\\') {
        e.preventDefault()
        useAiStore.getState().toggleSidebar()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
