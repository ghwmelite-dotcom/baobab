import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchBrave, type BraveEnv } from './brave'

const env: BraveEnv = {
  BRAVE_API_KEY: 'test-token',
}

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('searchBrave', () => {
  it('returns parsed results on success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      web: {
        results: [
          { title: 'A', url: 'https://a.com/x', description: 'foo', meta_url: { hostname: 'a.com' } },
          { title: 'B', url: 'https://b.com/y', description: 'bar', meta_url: { hostname: 'b.com' } },
        ],
      },
    }), { status: 200 }))
    const results = await searchBrave(env, 'test query', 10)
    expect(results).toHaveLength(2)
    expect(results[0]!.title).toBe('A')
    expect(results[0]!.meta_url?.hostname).toBe('a.com')
    expect(results[1]!.description).toBe('bar')
  })

  it('passes query, count to URL and token to header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ web: { results: [] } }), { status: 200 }))
    await searchBrave(env, 'paystack', 10)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('q=paystack')
    expect(url).toContain('count=10')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers['X-Subscription-Token']).toBe('test-token')
    expect(headers['Accept']).toBe('application/json')
  })

  it('returns empty array when web.results missing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    expect(await searchBrave(env, 'q', 10)).toEqual([])
  })

  it('returns empty array when web present but results missing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ web: {} }), { status: 200 }))
    expect(await searchBrave(env, 'q', 10)).toEqual([])
  })

  it('throws on non-200 status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    await expect(searchBrave(env, 'q', 10)).rejects.toThrow(/Brave.*429/)
  })

  it('clamps count to 1..20', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ web: { results: [] } }), { status: 200 }))
    await searchBrave(env, 'q', 50)
    expect(fetchMock.mock.calls[0]![0]).toContain('count=20')

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ web: { results: [] } }), { status: 200 }))
    await searchBrave(env, 'q', 0)
    expect(fetchMock.mock.calls[1]![0]).toContain('count=1')
  })
})
