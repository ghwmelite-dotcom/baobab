import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchGoogle, type PseEnv } from './pse'

const env: PseEnv = {
  GOOGLE_PSE_API_KEY: 'test-key',
  GOOGLE_PSE_CX: 'test-cx',
}

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('searchGoogle', () => {
  it('returns parsed results on success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      items: [
        { title: 'A', link: 'https://a.com/x', displayLink: 'a.com', snippet: 'foo' },
        { title: 'B', link: 'https://b.com/y', displayLink: 'b.com', snippet: 'bar' },
      ],
    }), { status: 200 }))
    const results = await searchGoogle(env, 'test query', 10)
    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('A')
    expect(results[0].displayLink).toBe('a.com')
    expect(results[1].snippet).toBe('bar')
  })

  it('passes query, num, key, cx to the URL', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    await searchGoogle(env, 'paystack', 10)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('q=paystack')
    expect(url).toContain('num=10')
    expect(url).toContain('key=test-key')
    expect(url).toContain('cx=test-cx')
  })

  it('returns empty array when items missing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
    expect(await searchGoogle(env, 'q', 10)).toEqual([])
  })

  it('throws on non-200 status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }))
    await expect(searchGoogle(env, 'q', 10)).rejects.toThrow(/PSE.*429/)
  })

  it('clamps num to 1..10', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    await searchGoogle(env, 'q', 25)
    expect(fetchMock.mock.calls[0][0]).toContain('num=10')

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    await searchGoogle(env, 'q', 0)
    expect(fetchMock.mock.calls[1][0]).toContain('num=1')
  })
})
