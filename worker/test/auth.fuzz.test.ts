import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

// Review fix #4: readJson<T> widens body fields to "string" at the type level
// but at runtime they may be numbers, arrays, objects, or null. Without
// runtime guards the route would crash into onError -> 500. These tests
// confirm every endpoint that takes a body cleanly returns 4xx instead.

const fuzzedFields: unknown[] = [
  12345,                        // number
  ['+233241112222'],            // array (would pass `body.phone` truthiness)
  { value: '+233241112222' },   // object
  null,                         // explicit null
  true,                         // boolean
  '',                           // empty string
]

async function post(path: string, body: unknown) {
  return SELF.fetch(`http://baobab${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function put(path: string, body: unknown, headers: Record<string, string> = {}) {
  return SELF.fetch(`http://baobab${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('fuzz — non-string body fields produce clean 4xx (no 500s)', () => {
  it('/otp/send rejects non-string phone', async () => {
    for (const phone of fuzzedFields) {
      const res = await post('/api/auth/otp/send', { phone })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('/otp/verify rejects non-string phone or code', async () => {
    for (const phone of fuzzedFields) {
      const res = await post('/api/auth/otp/verify', { phone, code: '123456' })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
    for (const code of fuzzedFields) {
      const res = await post('/api/auth/otp/verify', { phone: '+233241112222', code })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('/signup rejects non-string email or password', async () => {
    for (const email of fuzzedFields) {
      const res = await post('/api/auth/signup', { email, password: 'long-password-123' })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
    for (const password of fuzzedFields) {
      const res = await post('/api/auth/signup', { email: `f-${Date.now()}@x.com`, password })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('/login rejects non-string email or password (clean 4xx)', async () => {
    // Status range covers both 401 (uniform-credentials response) and 429
    // (rate limit kicks in after 10 — fuzzedFields has 6 each direction so
    // the 12 total can trip Phase 8's 10/min limit). The "uniform 401"
    // property is asserted in auth.login.test.ts where the request count
    // stays under the limit.
    for (const email of fuzzedFields) {
      const res = await post('/api/auth/login', { email, password: 'long-password-123' })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
    for (const password of fuzzedFields) {
      const res = await post('/api/auth/login', { email: 'real@x.com', password })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('/refresh rejects non-string refresh', async () => {
    for (const refresh of fuzzedFields) {
      const res = await post('/api/auth/refresh', { refresh })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('/password rejects non-string current or next (with valid bearer)', async () => {
    // Sign up to get a working bearer.
    const sup = await post('/api/auth/signup', {
      email: `fp-${Date.now()}@x.com`,
      password: 'long-password-123',
    })
    const { access } = await sup.json() as { access: string }
    const auth = { Authorization: `Bearer ${access}` }

    for (const current of fuzzedFields) {
      const res = await put('/api/auth/password', { current, next: 'long-password-12345' }, auth)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
    for (const next of fuzzedFields) {
      const res = await put('/api/auth/password', { current: 'long-password-123', next }, auth)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })

  it('all routes reject empty body cleanly (no 500s)', async () => {
    const paths = [
      '/api/auth/otp/send',
      '/api/auth/otp/verify',
      '/api/auth/signup',
      '/api/auth/login',
      '/api/auth/refresh',
    ]
    for (const path of paths) {
      const res = await post(path, {})
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })
})
