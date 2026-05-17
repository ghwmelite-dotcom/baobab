import { create } from 'zustand'
import { BaobabClient, AiClient } from '@baobab/cloud-client'
import type {
  SearchRequest,
  SearchResponse,
  SearchCitation,
  SearchResult,
  SearchSiteCard,
} from '@baobab/cloud-client'

// Re-export types that downstream components import from this module.
export type { SearchResult, SearchCitation, SearchSiteCard }

const baseUrl =
  (import.meta as { env?: Record<string, string> }).env?.VITE_BAOBAB_API_URL ??
  'https://baobab-api.ohcsghana-main.workers.dev'

const client = new BaobabClient({ baseUrl })
const ai = new AiClient(client)

const MAX_CHAIN = 5

export interface SearchState {
  query: string
  status: 'idle' | 'loading' | 'success' | 'error'
  intent: 'navigational' | 'informational' | null
  answer: { en: string; bilingual?: { lang: string; text: string } } | null
  citations: SearchCitation[]
  results: SearchResult[]
  diversity: { sourceCount: number; countryCount: number; africanVoicePercent: number } | null
  siteCard: SearchSiteCard | null
  contextChain: Array<{ query: string; answer: string }>
  targetLanguage: string | null
  error: 'auth_required' | 'unavailable' | 'quota_degraded' | null
  errorDetail?: string
  meta: SearchResponse['meta'] | null
  setTargetLanguage: (lang: string | null) => void
  runSearch: (query: string) => Promise<void>
  refine: (query: string) => Promise<void>
}

// Module-level counter used for stale-response guard.
let requestCounter = 0

export const useSearchData = create<SearchState>()((set, get) => ({
  query: '',
  status: 'idle',
  intent: null,
  answer: null,
  citations: [],
  results: [],
  diversity: null,
  siteCard: null,
  contextChain: [],
  targetLanguage: null,
  error: null,
  meta: null,

  setTargetLanguage: (lang) => set({ targetLanguage: lang }),

  runSearch: async (rawQuery) => {
    const query = rawQuery.trim()
    if (!query) return

    const myId = ++requestCounter
    set({ query, status: 'loading', error: null, errorDetail: undefined })

    try {
      const resp = await ai.search({
        query,
        context: get().contextChain,
        ...(get().targetLanguage
          ? { targetLanguage: get().targetLanguage as SearchRequest['targetLanguage'] }
          : {}),
      })

      // Discard if a newer request has already started.
      if (myId !== requestCounter) return

      const isQuotaDegraded = resp.meta.fallbackMode === 'quota-degraded'

      set({
        status: 'success',
        intent: resp.intent,
        answer: resp.answer,
        citations: resp.citations,
        results: resp.results,
        diversity: resp.diversity,
        siteCard: resp.siteCard ?? null,
        meta: resp.meta,
        error: isQuotaDegraded ? 'quota_degraded' : null,
      })
    } catch (e) {
      if (myId !== requestCounter) return

      const msg = e instanceof Error ? e.message : String(e)
      const isAuth = /401|auth/i.test(msg)

      set({
        status: 'error',
        error: isAuth ? 'auth_required' : 'unavailable',
        errorDetail: msg,
      })
    }
  },

  refine: async (query) => {
    const current = get()
    // Push the current answer into the chain before running the next search.
    const nextChain = current.answer
      ? [...current.contextChain, { query: current.query, answer: current.answer.en }].slice(-MAX_CHAIN)
      : current.contextChain

    set({ contextChain: nextChain })
    await get().runSearch(query)
  },
}))
