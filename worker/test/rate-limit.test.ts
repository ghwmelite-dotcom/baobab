import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:test'
import { rateLimit } from '../src/middleware/rate-limit'
import type { AppContext } from '../src/types'

function makeApp(prefix: string, requests = 3, windowSec = 60) {
  const app = new Hono<AppContext>()
  app.use('*', rateLimit({ requests, windowSec, keyPrefix: prefix }))
  app.get('/', (c) => c.text('ok'))
  return app
}

async function hit(app: Hono<AppContext>, ip = '1.2.3.4') {
  return app.request('/', { headers: { 'CF-Connecting-IP': ip } }, env)
}

describe('rate-limit middleware', () => {
  it('allows up to N requests then 429s', async () => {
    const app = makeApp('test-allow-then-429')
    for (let i = 0; i < 3; i++) {
      const r = await hit(app)
      expect(r.status).toBe(200)
    }
    const fourth = await hit(app)
    expect(fourth.status).toBe(429)
  })

  it('returns Retry-After and X-RateLimit-* headers on 429', async () => {
    const app = makeApp('test-headers')
    for (let i = 0; i < 3; i++) await hit(app)
    const blocked = await hit(app)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBeTruthy()
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('3')
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(blocked.headers.get('X-RateLimit-Reset')).toBeTruthy()
  })

  it('reports remaining count on success responses', async () => {
    const app = makeApp('test-remaining')
    const r1 = await hit(app)
    expect(r1.headers.get('X-RateLimit-Remaining')).toBe('2')
    const r2 = await hit(app)
    expect(r2.headers.get('X-RateLimit-Remaining')).toBe('1')
    const r3 = await hit(app)
    expect(r3.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('different IPs have independent buckets', async () => {
    const app = makeApp('test-ip-isolation')
    for (let i = 0; i < 3; i++) await hit(app, '1.1.1.1')
    // 1.1.1.1 is now exhausted.
    const blocked = await hit(app, '1.1.1.1')
    expect(blocked.status).toBe(429)
    // 2.2.2.2 still has a clean bucket.
    const fresh = await hit(app, '2.2.2.2')
    expect(fresh.status).toBe(200)
  })

  it('different keyPrefixes do not share buckets', async () => {
    const a = makeApp('test-prefix-a')
    const b = makeApp('test-prefix-b')
    for (let i = 0; i < 3; i++) await hit(a)
    expect((await hit(a)).status).toBe(429)
    // Same IP on a different keyPrefix should be unaffected.
    expect((await hit(b)).status).toBe(200)
  })

  it('treats missing CF-Connecting-IP as a single shared "unknown" bucket', async () => {
    const app = makeApp('test-unknown-ip')
    // No CF-Connecting-IP header at all.
    for (let i = 0; i < 3; i++) {
      const r = await app.request('/', {}, env)
      expect(r.status).toBe(200)
    }
    const blocked = await app.request('/', {}, env)
    expect(blocked.status).toBe(429)
  })
})
