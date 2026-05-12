import { create } from 'zustand'
import type { OfflineArticle } from '@baobab/cloud-client'
import { offlineClient } from './api'
import type { ReaderArticle } from '~/reader/api'

interface OfflineState {
  drawerOpen: boolean
  items: OfflineArticle[]
  loading: boolean
  toggle: () => void
  refresh: () => Promise<void>
  save: (article: ReaderArticle) => Promise<void>
  remove: (id: string) => Promise<void>
  markRead: (id: string) => Promise<void>
}

export const useOfflineStore = create<OfflineState>()((set, get) => ({
  drawerOpen: false,
  items: [],
  loading: false,

  toggle: () => set((s) => ({ drawerOpen: !s.drawerOpen })),

  refresh: async () => {
    set({ loading: true })
    try {
      const r = await offlineClient.list()
      set({ items: r.items, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  save: async (a) => {
    await offlineClient.save({
      url: a.url,
      title: a.title,
      cleaned_html: a.cleaned_html,
      ai_summary: a.ai_summary,
      word_count: a.word_count,
      est_read_minutes: a.est_read_minutes,
    })
    await get().refresh()
  },

  remove: async (id) => {
    await offlineClient.delete(id)
    await get().refresh()
  },

  markRead: async (id) => {
    await offlineClient.markRead(id)
    await get().refresh()
  },
}))
