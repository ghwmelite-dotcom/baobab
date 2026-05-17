import { describe, it, expect, vi } from 'vitest'
import { BaobabClient } from './client'
import { AiClient } from './ai'
import type { SearchResponse } from './ai'

const makeSearchResponse = (overrides: Partial<SearchResponse> = {}): SearchResponse => ({
  intent: 'informational',
  query: 'x',
  answer: { en: 'a' },
  citations: [],
  results: [],
  diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
  meta: { cached: false, pseQueriesRemainingToday: 100 },
  ...overrides,
})

describe('AiClient.search v2 signature', () => {
  it('accepts context, targetLanguage, source params', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response(JSON.stringify(makeSearchResponse()), { status: 200 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x', fetch: fetchMock })
    const result = await new AiClient(client).search({
      query: 'follow-up',
      context: [{ query: 'a', answer: 'b' }],
      targetLanguage: 'yo',
      source: { url: 'https://example.com', title: 'Page' },
    })
    expect(result.answer?.en).toBe('a')

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body.context).toEqual([{ query: 'a', answer: 'b' }])
    expect(body.targetLanguage).toBe('yo')
    expect(body.source).toEqual({ url: 'https://example.com', title: 'Page' })
  })

  it('backward-compat: bare query still works', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response(JSON.stringify(makeSearchResponse()), { status: 200 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x', fetch: fetchMock })
    await new AiClient(client).search({ query: 'simple' })
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(body.query).toBe('simple')
    expect(body.context).toBeUndefined()
  })

  it('hits /api/search (not /api/ai/search)', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response(JSON.stringify(makeSearchResponse()), { status: 200 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://api.test', fetch: fetchMock })
    await new AiClient(client).search({ query: 'test' })
    const url = fetchMock.mock.calls[0]?.[0] as string
    expect(url).toBe('https://api.test/api/search')
  })

  it('throws on non-2xx responses', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response('{"error":"bad"}', { status: 500 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x', fetch: fetchMock })
    await expect(new AiClient(client).search({ query: 'oops' })).rejects.toThrow('search 500')
  })
})
