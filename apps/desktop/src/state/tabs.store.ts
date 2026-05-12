import { create } from 'zustand'
import type { Tab } from '@baobab/core'
import {
  ipcCreateTab,
  ipcCloseTab,
  ipcShowTab,
  ipcNavigateTab,
  ipcTabGoBack,
  ipcTabGoForward,
} from '~/ipc/tabs'
import { useHistoryStore } from '~/history/history.store'
import { persistence } from '~/state/persistence'

interface HistoryCursor {
  depth: number
  max: number
}

interface TabsState {
  tabs: Tab[]
  activeId: string | null
  // Per-tab navigation depth/max counter. Approximate: tracks IPC-driven
  // navigations only — in-page JS history.pushState / popstate won't sync.
  history: Record<string, HistoryCursor>
  openTab: (url: string) => Promise<string>
  closeTab: (id: string) => Promise<void>
  setActive: (id: string) => void
  navigate: (id: string, url: string) => Promise<void>
  goBack: (id: string) => Promise<void>
  goForward: (id: string) => Promise<void>
  canGoBack: (id: string) => boolean
  canGoForward: (id: string) => boolean
  reorderTab: (id: string, toIndex: number) => void
  togglePin: (id: string) => void
  hydrate: () => Promise<void>
}

interface TabsSnapshot {
  tabs: Tab[]
  activeId: string | null
}

const SNAPSHOT_KEY = 'tabs.snapshot'

let counter = 0
const nextId = () => `t${Date.now().toString(36)}-${++counter}`

let hydrating = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let subscribed = false

function isValidSnapshot(v: unknown): v is TabsSnapshot {
  if (!v || typeof v !== 'object') return false
  const o = v as { tabs?: unknown; activeId?: unknown }
  if (!Array.isArray(o.tabs)) return false
  if (o.activeId !== null && typeof o.activeId !== 'string') return false
  return o.tabs.every((t) => t && typeof t === 'object' && typeof (t as Tab).url === 'string')
}

function scheduleSave(state: TabsState): void {
  if (hydrating) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const tabs = state.tabs.filter(
      (t) => !(t as Tab & { incognito?: boolean }).incognito,
    )
    void persistence.set<TabsSnapshot>(SNAPSHOT_KEY, { tabs, activeId: state.activeId })
  }, 300)
}

export const useTabsStore = create<TabsState>()((set, get) => ({
  tabs: [],
  activeId: null,
  history: {},

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
      return {
        tabs,
        activeId: id,
        history: { ...s.history, [id]: { depth: 0, max: 0 } },
      }
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
      const history: Record<string, HistoryCursor> = {}
      for (const k of Object.keys(s.history)) {
        if (k === id) continue
        const v = s.history[k]
        if (v) history[k] = v
      }
      return { tabs, activeId, history }
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
    set((s) => {
      const cur = s.history[id] ?? { depth: 0, max: 0 }
      const nextDepth = cur.depth + 1
      return {
        tabs: s.tabs.map((t) =>
          t.id === id ? { ...t, url, loading: true, lastVisitedAt: Date.now() } : t,
        ),
        history: { ...s.history, [id]: { depth: nextDepth, max: nextDepth } },
      }
    })
    void useHistoryStore.getState().recordVisit(url)
  },

  goBack: async (id) => {
    const cur = get().history[id]
    if (!cur || cur.depth <= 0) return
    await ipcTabGoBack(id)
    set((s) => {
      const c = s.history[id]
      if (!c) return s
      return { history: { ...s.history, [id]: { ...c, depth: c.depth - 1 } } }
    })
  },

  goForward: async (id) => {
    const cur = get().history[id]
    if (!cur || cur.depth >= cur.max) return
    await ipcTabGoForward(id)
    set((s) => {
      const c = s.history[id]
      if (!c) return s
      return { history: { ...s.history, [id]: { ...c, depth: c.depth + 1 } } }
    })
  },

  canGoBack: (id) => {
    const c = get().history[id]
    return !!c && c.depth > 0
  },

  canGoForward: (id) => {
    const c = get().history[id]
    return !!c && c.depth < c.max
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

  hydrate: async () => {
    hydrating = true
    try {
      const snap = await persistence.get<TabsSnapshot>(SNAPSHOT_KEY)
      if (isValidSnapshot(snap)) {
        const idMap = new Map<string, string>()
        for (const saved of snap.tabs) {
          try {
            const newId = await get().openTab(saved.url)
            idMap.set(saved.id, newId)
            set((s) => ({
              tabs: s.tabs.map((t) =>
                t.id === newId
                  ? { ...t, title: saved.title, pinned: saved.pinned }
                  : t,
              ),
            }))
          } catch {
            /* tolerate and continue */
          }
        }
        const mappedActive = snap.activeId ? idMap.get(snap.activeId) : null
        if (mappedActive) {
          get().setActive(mappedActive)
        }
      }
    } catch {
      /* tolerate */
    } finally {
      hydrating = false
    }

    if (!subscribed) {
      subscribed = true
      useTabsStore.subscribe((state, prev) => {
        if (state.tabs !== prev.tabs || state.activeId !== prev.activeId) {
          scheduleSave(state)
        }
      })
    }
  },
}))
