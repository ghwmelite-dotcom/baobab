import { describe, it, expect, vi, beforeEach } from 'vitest'

const aiMocks = vi.hoisted(() => ({
  search: vi.fn(),
}))

vi.mock('~/ai/api', () => ({
  aiClient: aiMocks,
}))

import { useSearchData } from '~/search/useSearchData'

beforeEach(() => {
  aiMocks.search.mockReset()
  useSearchData.setState({
    query: '',
    status: 'idle',
    answer: '',
    results: [],
    error: null,
    requestId: 0,
  })
})

describe('useSearchData', () => {
  it('runSearch transitions to loading then success', async () => {
    aiMocks.search.mockResolvedValue({
      answer: 'Baobab is a tree.',
      results: [{ title: 'Wikipedia', url: 'https://wikipedia.org/wiki/Baobab' }],
    })
    const promise = useSearchData.getState().runSearch('baobab')
    expect(useSearchData.getState().status).toBe('loading')
    expect(useSearchData.getState().query).toBe('baobab')
    await promise
    const s = useSearchData.getState()
    expect(s.status).toBe('success')
    expect(s.answer).toBe('Baobab is a tree.')
    expect(s.results).toHaveLength(1)
  })

  it('runSearch sets error state to auth_required on 401', async () => {
    aiMocks.search.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))
    await useSearchData.getState().runSearch('q')
    const s = useSearchData.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('auth_required')
  })

  it('runSearch sets error state to unavailable on non-401 errors', async () => {
    aiMocks.search.mockRejectedValue(new Error('network failure'))
    await useSearchData.getState().runSearch('q')
    const s = useSearchData.getState()
    expect(s.status).toBe('error')
    expect(s.error).toBe('unavailable')
  })

  it('a stale response is discarded when a newer search is in flight', async () => {
    let resolveFirst: (v: unknown) => void = () => {}
    const firstPromise = new Promise((res) => { resolveFirst = res })
    aiMocks.search.mockReturnValueOnce(firstPromise)
    aiMocks.search.mockResolvedValueOnce({ answer: 'second', results: [] })

    const p1 = useSearchData.getState().runSearch('first')
    await useSearchData.getState().runSearch('second')

    // Now resolve the first request — it should be ignored because requestId moved on.
    resolveFirst({ answer: 'first', results: [{ title: 'stale', url: 'https://stale.example' }] })
    await p1

    const s = useSearchData.getState()
    expect(s.answer).toBe('second')
    expect(s.query).toBe('second')
    expect(s.results).toHaveLength(0)
  })

  it('runSearch with empty query is a no-op', async () => {
    await useSearchData.getState().runSearch('  ')
    expect(aiMocks.search).not.toHaveBeenCalled()
    expect(useSearchData.getState().status).toBe('idle')
  })
})
