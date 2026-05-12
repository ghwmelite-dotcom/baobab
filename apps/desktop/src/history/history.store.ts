import { create } from 'zustand'
import type { HistoryItem } from '@baobab/cloud-client'
import { historyClient } from './api'

interface HistoryState {
  drawerOpen: boolean
  items: HistoryItem[]
  query: string
  loading: boolean
  toggle: () => void
  refresh: (q?: string) => Promise<void>
  clear: () => Promise<void>
  recordVisit: (url: string, title?: string) => Promise<void>
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  drawerOpen: false,
  items: [],
  query: '',
  loading: false,

  toggle: () => set((s) => ({ drawerOpen: !s.drawerOpen })),

  refresh: async (q) => {
    set({ loading: true, query: q ?? '' })
    try {
      const r = await historyClient.list({ q, limit: 50 })
      set({ items: r.items, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  clear: async () => {
    try {
      await historyClient.clear()
      await get().refresh()
    } catch { /* tolerate */ }
  },

  recordVisit: async (url, title) => {
    try { await historyClient.record(url, title) } catch { /* tolerate */ }
  },
}))
