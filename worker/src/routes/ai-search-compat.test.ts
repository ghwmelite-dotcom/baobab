import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('/api/ai/search backward compat', () => {
  it('still returns the v1 shape { answer, results: [{title, url}] }', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      items: [{ title: 'T', link: 'https://a.com', displayLink: 'a.com', snippet: 's' }],
    }), { status: 200 }))

    const mockKv = { get: vi.fn(async () => null), put: vi.fn(), delete: vi.fn() } as unknown as KVNamespace
    const env = {
      GOOGLE_PSE_API_KEY: 'k', GOOGLE_PSE_CX: 'cx',
      KV: mockKv,
      RATE_LIMITS: mockKv,
      AI: { run: vi.fn(async () => ({ response: JSON.stringify({ answer: 'ans', citations: [] }) })) },
    }

    const { ai } = await import('./ai')
    const app = new Hono<{ Bindings: typeof env }>()
    app.route('/api/ai', ai)

    const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext
    const resp = await app.request('/api/ai/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    }, env, ctx)

    expect(resp.status).toBe(200)
    const body = await resp.json() as { answer: string; results: Array<{ title: string; url: string }> }
    expect(typeof body.answer).toBe('string')
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.results[0]).toHaveProperty('title')
    expect(body.results[0]).toHaveProperty('url')
    expect(body.results[0]).not.toHaveProperty('isAfrican')
  })
})
