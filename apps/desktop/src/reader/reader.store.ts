import { create } from 'zustand'
import { fetchReader, type ReaderArticle } from './api'

interface ReaderState {
  open: boolean
  article: ReaderArticle | null
  loading: boolean
  error: string | null
  openFor: (url: string) => Promise<void>
  close: () => void
}

export const useReaderStore = create<ReaderState>()((set) => ({
  open: false,
  article: null,
  loading: false,
  error: null,
  openFor: async (url) => {
    set({ open: true, loading: true, error: null, article: null })
    try {
      const a = await fetchReader(url)
      set({ article: a, loading: false })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'failed', loading: false })
    }
  },
  close: () => set({ open: false, article: null }),
}))
