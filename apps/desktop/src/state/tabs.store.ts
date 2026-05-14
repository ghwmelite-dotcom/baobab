import { create } from 'zustand'
import type { Tab } from '@baobab/core'
import {
  ipcCreateTab,
  ipcCloseTab,
  ipcShowTab,
  ipcNavigateTab,
  ipcTabGoBack,
  ipcTabGoForward,
  onTabLoaded,
  type IpcTabLoaded,
} from '~/ipc/tabs'
import { useHistoryStore } from '~/history/history.store'
import { persistence } from '~/state/persistence'

/**
 * Derive a 32×32 favicon URL from a navigation URL.
 *
 * Uses Google's s2 service — same pattern Chrome, Edge, Brave, and Arc
 * use as a fallback when the page doesn't expose a usable
 * `<link rel="icon">`. Returns `undefined` for opaque schemes (about:,
 * data:, javascript:, file:) so we don't render placeholders for the
 * New Tab Page or local files.
 */
export function faviconForUrl(url: string): string | undefined {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined
    const host = u.hostname
    if (!host) return undefined
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`
  } catch {
    return undefined
  }
}

interface HistoryCursor {
  depth: number
  max: number
}

interface OpenTabOptions {
  incognito?: boolean
}

interface TabsState {
  tabs: Tab[]
  activeId: string | null
  // Per-tab navigation depth/max counter. Approximate: tracks IPC-driven
  // navigations only — in-page JS history.pushState / popstate won't sync.
  history: Record<string, HistoryCursor>
  /** True once `tab://loaded` listener is registered. State (not module-level) so tests can reset it. */
  tabLoadedListening: boolean
  openTab: (url: string, opts?: OpenTabOptions) => Promise<string>
  openIncognitoTab: (url: string) => Promise<string>
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
  /** Apply a `tab://loaded` event payload to the matching tab. */
  handleTabLoaded: (payload: IpcTabLoaded) => void
  /** Idempotently subscribe to `tab://loaded` events from the backend. */
  initListeners: () => Promise<void>
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
    const tabs = state.tabs.filter((t) => !t.incognito)
    void persistence.set<TabsSnapshot>(SNAPSHOT_KEY, { tabs, activeId: state.activeId })
  }, 300)
}

export const useTabsStore = create<TabsState>()((set, get) => ({
  tabs: [],
  activeId: null,
  history: {},
  tabLoadedListening: false,

  openTab: async (url, opts) => {
    const id = nextId()
    const incognito = opts?.incognito === true
    const tab: Tab = {
      id,
      url,
      title: url,
      pinned: false,
      active: true,
      loading: true,
      lastVisitedAt: Date.now(),
      ...(incognito ? { incognito: true } : {}),
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
    await ipcCreateTab(id, url, incognito)
    // Only un-hide the freshly-created webview when it has real content.
    // about:blank tabs stay hidden so the NewTabPage gradient is the only
    // thing visible. App.tsx's show/hide effect already reveals the
    // webview when the user navigates this tab to a real URL.
    if (url !== 'about:blank') {
      await ipcShowTab(id)
    }
    if (url !== 'about:blank' && !incognito) {
      void useHistoryStore.getState().recordVisit(url)
    }
    return id
  },

  openIncognitoTab: async (url) => {
    return get().openTab(url, { incognito: true })
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
    const isIncognito = get().tabs.find((t) => t.id === id)?.incognito === true
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
    if (!isIncognito) {
      void useHistoryStore.getState().recordVisit(url)
    }
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

  handleTabLoaded: (payload) => {
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === payload.id)
      if (idx === -1) return s
      const current = s.tabs[idx]
      if (!current) return s
      const incomingTitle = payload.title?.trim() ?? ''
      const nextTitle = incomingTitle.length > 0 ? incomingTitle : current.title
      const nextUrl = payload.url && payload.url.length > 0 ? payload.url : current.url
      const favicon = faviconForUrl(nextUrl)
      const updated: Tab = {
        ...current,
        title: nextTitle,
        url: nextUrl,
        loading: false,
        lastVisitedAt: Date.now(),
        ...(favicon ? { faviconUrl: favicon } : { faviconUrl: undefined }),
      }
      const tabs = [...s.tabs.slice(0, idx), updated, ...s.tabs.slice(idx + 1)]
      return { tabs }
    })
  },

  initListeners: async () => {
    if (get().tabLoadedListening) return
    set({ tabLoadedListening: true })
    await onTabLoaded((p) => get().handleTabLoaded(p))
  },
}))
