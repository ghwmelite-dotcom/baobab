import { create } from 'zustand'
import { aiClient } from '~/ai/api'

export interface SearchResult {
  title: string
  url: string
}

type Status = 'idle' | 'loading' | 'success' | 'error'
type ErrorKind = 'auth_required' | 'unavailable'

interface SearchDataState {
  query: string
  status: Status
  answer: string
  results: SearchResult[]
  error: ErrorKind | null
  requestId: number
  runSearch: (query: string) => Promise<void>
}

function classifyError(e: unknown): ErrorKind {
  const status = (e as { status?: number } | null)?.status
  if (status === 401) return 'auth_required'
  return 'unavailable'
}

export const useSearchData = create<SearchDataState>((set, get) => ({
  query: '',
  status: 'idle',
  answer: '',
  results: [],
  error: null,
  requestId: 0,

  runSearch: async (rawQuery) => {
    const query = rawQuery.trim()
    if (!query) return
    const nextId = get().requestId + 1
    set({
      query,
      status: 'loading',
      answer: '',
      results: [],
      error: null,
      requestId: nextId,
    })
    try {
      const res = await aiClient.search({ query })
      if (get().requestId !== nextId) return // a newer search superseded
      set({
        status: 'success',
        answer: res.answer ?? '',
        results: Array.isArray(res.results) ? res.results : [],
        error: null,
      })
    } catch (e) {
      if (get().requestId !== nextId) return
      set({
        status: 'error',
        answer: '',
        results: [],
        error: classifyError(e),
      })
    }
  },
}))
