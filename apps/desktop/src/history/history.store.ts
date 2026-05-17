import { create } from 'zustand'
import type { HistoryItem } from '@baobab/cloud-client'
import { historyClient } from './api'
import { useAuthStore } from '~/auth/auth.store'
import { gate } from '~/data/wifiGate'

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
    if (!useAuthStore.getState().user) return
    try {
      const r = await gate(() => historyClient.record(url, title))
      if (r === null) {
        // Deferred until Wi-Fi. Visit is dropped for v1 (no local queue).
        return
      }
    } catch { /* tolerate */ }
  },
}))
