import { create } from 'zustand'
import type { Tab } from '@baobab/core'
import { ipcCreateTab, ipcCloseTab, ipcShowTab, ipcNavigateTab } from '~/ipc/tabs'
import { useHistoryStore } from '~/history/history.store'

interface TabsState {
  tabs: Tab[]
  activeId: string | null
  openTab: (url: string) => Promise<string>
  closeTab: (id: string) => Promise<void>
  setActive: (id: string) => void
  navigate: (id: string, url: string) => Promise<void>
  reorderTab: (id: string, toIndex: number) => void
  togglePin: (id: string) => void
}

let counter = 0
const nextId = () => `t${Date.now().toString(36)}-${++counter}`

export const useTabsStore = create<TabsState>()((set, get) => ({
  tabs: [],
  activeId: null,

  openTab: async (url) => {
    const id = nextId()
    const tab: Tab = {
      id,
      url,
      title: url,
      pinned: false,
      active: true,
      loading: true,
      lastVisitedAt: Date.now(),
    }
    set((s) => {
      const activeIdx = s.tabs.findIndex((t) => t.id === s.activeId)
      const insertAt = activeIdx === -1 ? s.tabs.length : activeIdx + 1
      const tabs = [...s.tabs.slice(0, insertAt), tab, ...s.tabs.slice(insertAt)]
      return { tabs, activeId: id }
    })
    await ipcCreateTab(id, url)
    await ipcShowTab(id)
    if (url !== 'about:blank') {
      void useHistoryStore.getState().recordVisit(url)
    }
    return id
  },

  closeTab: async (id) => {
    await ipcCloseTab(id)
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id)
      if (idx === -1) return s
      const tabs = [...s.tabs.slice(0, idx), ...s.tabs.slice(idx + 1)]
      let activeId = s.activeId
      if (activeId === id) {
        activeId = tabs[idx]?.id ?? tabs[idx - 1]?.id ?? null
      }
      return { tabs, activeId }
    })
    const next = get().activeId
    if (next) await ipcShowTab(next)
  },

  setActive: (id) => {
    set({ activeId: id })
    void ipcShowTab(id)
  },

  navigate: async (id, url) => {
    await ipcNavigateTab(id, url)
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, url, loading: true, lastVisitedAt: Date.now() } : t,
      ),
    }))
    void useHistoryStore.getState().recordVisit(url)
  },

  reorderTab: (id, toIndex) => {
    set((s) => {
      const fromIdx = s.tabs.findIndex((t) => t.id === id)
      if (fromIdx === -1) return s
      const tab = s.tabs[fromIdx]
      if (!tab) return s
      const without = [...s.tabs.slice(0, fromIdx), ...s.tabs.slice(fromIdx + 1)]
      const clamped = Math.max(0, Math.min(toIndex, without.length))
      const tabs = [...without.slice(0, clamped), tab, ...without.slice(clamped)]
      return { tabs }
    })
  },

  togglePin: (id) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id)
      if (idx === -1) return s
      const tab = s.tabs[idx]
      if (!tab) return s
      const updated = { ...tab, pinned: !tab.pinned }
      const without = [...s.tabs.slice(0, idx), ...s.tabs.slice(idx + 1)]
      // Pinned tabs always sit at the front in pin order
      if (updated.pinned) {
        const lastPinnedIdx = without.findIndex((t) => !t.pinned)
        const insertAt = lastPinnedIdx === -1 ? without.length : lastPinnedIdx
        return { tabs: [...without.slice(0, insertAt), updated, ...without.slice(insertAt)] }
      }
      // Unpinning sends it to start of unpinned region
      const firstUnpinnedIdx = without.findIndex((t) => !t.pinned)
      const insertAt = firstUnpinnedIdx === -1 ? without.length : firstUnpinnedIdx
      return { tabs: [...without.slice(0, insertAt), updated, ...without.slice(insertAt)] }
    })
  },
}))
