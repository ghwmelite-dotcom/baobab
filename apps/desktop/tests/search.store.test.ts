import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @baobab/cloud-client so no real HTTP is made.
// vi.hoisted ensures mockSearch is available inside the vi.mock factory.
// ---------------------------------------------------------------------------
const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }))

vi.mock('@baobab/cloud-client', () => ({
  BaobabClient: vi.fn(() => ({})),
  AiClient: vi.fn(() => ({ search: mockSearch })),
}))

import { useSearchData } from '~/search/useSearchData'

// ---------------------------------------------------------------------------
// Shared reset helper (v1 + v2 state shape)
// ---------------------------------------------------------------------------
function resetState() {
  useSearchData.setState({
    query: '',
    status: 'idle',
    answer: null,
    results: [],
    citations: [],
    diversity: null,
    siteCard: null,
    contextChain: [],
    targetLanguage: null,
    intent: null,
    error: null,
    errorDetail: undefined,
    meta: null,
  })
}

beforeEach(() => {
  mockSearch.mockReset()
  resetState()
})

// ---------------------------------------------------------------------------
// Original behaviour tests (adapted to v2 shape)
// ---------------------------------------------------------------------------
describe('useSearchData', () => {
  it('runSearch transitions to loading then success', async () => {
    mockSearch.mockResolvedValue({
      intent: 'informational' as const,
      answer: { en: 'Baobab is a tree.' },
      citations: [],
      results: [{ title: 'Wikipedia', url: 'https://wikipedia.org/wiki/Baobab', snippet: '', source: '', country: null, isAfrican: false }],
      diversity: { sourceCount: 1, countryCount: 1, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    const promise = useSearchData.getState().runSearch('baobab')
    expect(useSearchData.getState().status).toBe('loading')
    expect(useSearchData.getState().query).toBe('baobab')
    await promise
    const s = useSearchData.getState()
    expect(s.status).toBe('success')
    expect(s.answer?.en).toBe('Baobab is a tree.')
    expect(s.results).toHaveLength(1)
  })

  it('runSearch sets error state to auth_required on 401', async () => {
    mockSearch.mockRejectedValue(Object.assign(new Error('unauthorized'), { message: '401 auth' }))
    await useSearchData.getState().runSearch('q')
    const s = useSearchData.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('auth_required')
  })

  it('runSearch sets error state to unavailable on non-401 errors', async () => {
    mockSearch.mockRejectedValue(new Error('network failure'))
    await useSearchData.getState().runSearch('q')
    const s = useSearchData.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('unavailable')
  })

  it('a stale response is discarded when a newer search is in flight', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    const firstPromise = new Promise((res) => { resolveFirst = res })
    mockSearch.mockReturnValueOnce(firstPromise)
    mockSearch.mockResolvedValueOnce({
      intent: 'informational' as const,
      answer: { en: 'second' },
      citations: [],
      results: [],
      diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })

    const p1 = useSearchData.getState().runSearch('first')
    await useSearchData.getState().runSearch('second')

    // Resolve the first request — should be ignored because requestCounter moved on.
    resolveFirst({
      intent: 'informational' as const,
      answer: { en: 'first' },
      citations: [],
      results: [{ title: 'stale', url: 'https://stale.example', snippet: '', source: '', country: null, isAfrican: false }],
      diversity: { sourceCount: 1, countryCount: 1, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    await p1

    const s = useSearchData.getState()
    expect(s.answer?.en).toBe('second')
    expect(s.query).toBe('second')
    expect(s.results).toHaveLength(0)
  })

  it('runSearch with empty query is a no-op', async () => {
    await useSearchData.getState().runSearch('  ')
    expect(mockSearch).not.toHaveBeenCalled()
    expect(useSearchData.getState().status).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// v2 behaviour tests: contextChain, refine, siteCard, stale-guard
// ---------------------------------------------------------------------------
describe('useSearchData v2', () => {
  it('refine appends to contextChain and runs new search', async () => {
    mockSearch.mockResolvedValue({
      intent: 'informational' as const,
      answer: { en: 'answer for first' },
      citations: [],
      results: [],
      diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    await useSearchData.getState().runSearch('first')
    expect(useSearchData.getState().contextChain).toEqual([])

    mockSearch.mockResolvedValue({
      intent: 'informational' as const,
      answer: { en: 'answer for second' },
      citations: [],
      results: [],
      diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    await useSearchData.getState().refine('second')
    const chain = useSearchData.getState().contextChain
    expect(chain).toHaveLength(1)
    const entry = chain[0]!
    expect(entry.query).toBe('first')
    expect(entry.answer).toBe('answer for first')

    expect(useSearchData.getState().query).toBe('second')
    expect(useSearchData.getState().answer?.en).toBe('answer for second')
  })

  it('contextChain caps at 5 entries', async () => {
    mockSearch.mockResolvedValue({
      intent: 'informational' as const,
      answer: { en: 'ans' },
      citations: [],
      results: [],
      diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    for (let i = 0; i < 7; i++) {
      await useSearchData.getState().refine(`q${i}`)
    }
    expect(useSearchData.getState().contextChain.length).toBeLessThanOrEqual(5)
  })

  it('stale-response guard discards earlier requests', async () => {
    mockSearch.mockResolvedValue({
      intent: 'informational' as const,
      answer: { en: 'ans' },
      citations: [],
      results: [],
      diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    const p1 = useSearchData.getState().runSearch('slow')
    const p2 = useSearchData.getState().runSearch('fast')
    await Promise.all([p1, p2])
    expect(useSearchData.getState().query).toBe('fast')
  })

  it('sets siteCard when worker returns navigational intent', async () => {
    mockSearch.mockResolvedValueOnce({
      intent: 'navigational' as const,
      answer: null,
      citations: [],
      results: [],
      diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
      siteCard: { name: 'Paystack', url: 'https://paystack.com', description: 'p', sitelinks: [] },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    await useSearchData.getState().runSearch('paystack')
    expect(useSearchData.getState().intent).toBe('navigational')
    expect(useSearchData.getState().siteCard?.name).toBe('Paystack')
  })
})
