import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { search } from './search'

const mockKV = () => {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { store.set(k, v) }),
    delete: vi.fn(),
  } as unknown as KVNamespace
}

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

function buildEnv(aiResponse: string) {
  return {
    GOOGLE_PSE_API_KEY: 'k', GOOGLE_PSE_CX: 'cx',
    KV: mockKV(),
    AI: { run: vi.fn(async () => ({ response: aiResponse })) },
  }
}

function appWithSearch(env: ReturnType<typeof buildEnv>) {
  const app = new Hono<{ Bindings: typeof env }>()
  app.route('/api/search', search)
  return { app, env }
}

describe('POST /api/search', () => {
  it('informational query returns answer + ranked results + diversity meter', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      items: [
        { title: 'CNN piece', link: 'https://cnn.com/x', displayLink: 'cnn.com', snippet: 's1' },
        { title: 'Mali source', link: 'https://history.za/y', displayLink: 'history.za', snippet: 's2' },
      ],
    }), { status: 200 }))
    const { app, env } = appWithSearch(buildEnv(JSON.stringify({
      answer: 'Mansa Musa ruled Mali...',
      citations: [{ name: 'Souleymane Sidibé', country: 'ML', type: 'scholar' }],
    })))

    const resp = await app.request('/api/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'history of Mansa Musa' }),
    }, env)

    expect(resp.status).toBe(200)
    const body = await resp.json() as { intent: string; results: { source: string }[]; answer: { en: string }; diversity: { africanVoicePercent: number }; meta: { cached: boolean } }
    expect(body.intent).toBe('informational')
    expect(body.results[0].source).toBe('history.za')
    expect(body.results[1].source).toBe('cnn.com')
    expect(body.answer.en).toContain('Mansa Musa')
    expect(body.diversity.africanVoicePercent).toBe(50)
    expect(body.meta.cached).toBe(false)
  })

  it('navigational query returns site card', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      items: [
        { title: 'Paystack - Modern payments', link: 'https://paystack.com/', displayLink: 'paystack.com', snippet: 'Modern payments', pagemap: { metatags: [{ 'og:site_name': 'Paystack', 'og:description': 'Payments for Africa' }] } },
      ],
    }), { status: 200 }))
    const { app, env } = appWithSearch(buildEnv(JSON.stringify({ answer: '', citations: [] })))

    const resp = await app.request('/api/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'paystack' }),
    }, env)

    const body = await resp.json() as { intent: string; siteCard: { name: string } | null }
    expect(body.intent).toBe('navigational')
    expect(body.siteCard?.name).toBe('Paystack')
  })

  it('cache hit returns immediately without PSE call', async () => {
    const env = buildEnv(JSON.stringify({ answer: '', citations: [] }))
    const { app } = appWithSearch(env)

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
    await app.request('/api/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'cached' }),
    }, env)

    fetchMock.mockClear()
    const resp = await app.request('/api/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'cached' }),
    }, env)

    expect(fetchMock).not.toHaveBeenCalled()
    const body = await resp.json() as { meta: { cached: boolean } }
    expect(body.meta.cached).toBe(true)
  })

  it('returns 400 on empty query', async () => {
    const { app, env } = appWithSearch(buildEnv(''))
    const resp = await app.request('/api/search', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '' }),
    }, env)
    expect(resp.status).toBe(400)
  })
})
