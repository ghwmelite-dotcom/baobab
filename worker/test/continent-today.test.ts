import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { SELF, env } from 'cloudflare:test'

// Minimal RSS fixture — one item per call, with title/link/description/pubDate.
// We vary the title/link per source so the digest builds a heterogenous set.
function rssFor(sourceId: string, pubDate: string): string {
  return `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    <title>${sourceId}</title>
    <item>
      <title>Headline from ${sourceId}</title>
      <link>https://example.test/${sourceId}/a</link>
      <description><![CDATA[Body text from ${sourceId} A]]></description>
      <pubDate>${pubDate}</pubDate>
    </item>
    <item>
      <title>Second headline from ${sourceId}</title>
      <link>https://example.test/${sourceId}/b</link>
      <description>Body text ${sourceId} B</description>
      <pubDate>${pubDate}</pubDate>
    </item>
  </channel></rss>`
}

const SOURCE_HOSTS: Record<string, string> = {
  'punchng.com': 'punch',
  'dailymaverick.co.za': 'daily-maverick',
  'premiumtimesng.com': 'premium-times',
  'nation.africa': 'daily-nation',
  'mg.co.za': 'mail-guardian',
  'techcabal.com': 'techcabal',
}

function sourceIdFor(url: string): string {
  for (const [host, id] of Object.entries(SOURCE_HOSTS)) {
    if (url.includes(host)) return id
  }
  return 'unknown'
}

const originalFetch = globalThis.fetch
let fetchCalls = 0

beforeEach(async () => {
  fetchCalls = 0
  // Clear the digest cache key in PAGE_CACHE between tests so each test
  // starts from a cold cache. The key is `digest:YYYY-MM-DD` (UTC today).
  const todayKey = `digest:${new Date().toISOString().slice(0, 10)}`
  await env.PAGE_CACHE.delete(todayKey)

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    fetchCalls++
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const id = sourceIdFor(url)
    return new Response(rssFor(id, new Date().toUTCString()), {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' },
    })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

interface DigestItem {
  id: string
  title: string
  summary: string
  source: { id: string; name: string; country: string }
  url: string
  publishedAt: string
}

describe('GET /api/continent-today', () => {
  it('returns up to 10 digest items shaped correctly', async () => {
    const r = await SELF.fetch('http://baobab/api/continent-today')
    expect(r.status).toBe(200)
    const body = (await r.json()) as { items: DigestItem[] }
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.length).toBeLessThanOrEqual(10)

    for (const item of body.items) {
      expect(typeof item.id).toBe('string')
      expect(typeof item.title).toBe('string')
      expect(item.title.length).toBeGreaterThan(0)
      expect(typeof item.summary).toBe('string')
      // The stub AI worker returns `ok`; real model is expected to produce
      // ≤80 words. Allow a generous 100-word ceiling for the assertion.
      expect(item.summary.split(/\s+/).length).toBeLessThanOrEqual(100)
      expect(item.source.id).toBeTruthy()
      expect(item.source.name).toBeTruthy()
      expect(item.source.country).toBeTruthy()
      expect(item.url).toMatch(/^https?:\/\//)
      expect(typeof item.publishedAt).toBe('string')
    }
  })

  it('serves the second call from cache (no extra RSS fetches)', async () => {
    const first = await SELF.fetch('http://baobab/api/continent-today')
    expect(first.status).toBe(200)
    const fetchesAfterFirst = fetchCalls
    expect(fetchesAfterFirst).toBeGreaterThan(0)

    const second = await SELF.fetch('http://baobab/api/continent-today')
    expect(second.status).toBe(200)
    // Second call should be a pure KV cache hit — no upstream RSS fetches.
    expect(fetchCalls).toBe(fetchesAfterFirst)

    const b1 = (await first.json()) as { items: DigestItem[] }
    const b2 = (await second.json()) as { items: DigestItem[] }
    expect(b2.items.length).toBe(b1.items.length)
  })
})
