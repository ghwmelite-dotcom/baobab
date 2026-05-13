import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { SELF } from 'cloudflare:test'
import type { Env } from '../src/types'
import { payments } from '../src/routes/payments'

// The vitest-pool-workers `env` import is a snapshot for the bound test
// runtime — its values are immutable from the test side, so we can't flip
// PAYSTACK_SECRET_KEY at runtime through that handle. Two-pronged
// strategy instead:
//
//   1. Default-config paths (no secret bound) → exercised via SELF.fetch,
//      which proves the route is correctly mounted on /api/payments/* and
//      that the unconfigured response shape is correct.
//
//   2. Configured paths → invoke the `payments` Hono sub-app directly with
//      a hand-built Env where PAYSTACK_SECRET_KEY is populated. This
//      runs the same handler code under the same Workers runtime, just
//      bypassing the global env binding for the secret.

function fakeEnv(overrides: Partial<Env>): Env {
  return overrides as unknown as Env
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('POST /api/payments/intent (default config — secret unset)', () => {
  it('returns 503 payments_unconfigured', async () => {
    const r = await SELF.fetch('http://baobab/api/payments/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 500,
        currency: 'NGN',
        customer_email: 'tip@example.test',
      }),
    })
    expect(r.status).toBe(503)
    const body = (await r.json()) as { error: string; message?: string }
    expect(body.error).toBe('payments_unconfigured')
    expect(typeof body.message).toBe('string')
  })
})

describe('POST /payments/intent (configured)', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns the Paystack authorization_url when the secret is configured', async () => {
    const fakeLink = 'https://checkout.paystack.com/abc123'
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      expect(url).toBe('https://api.paystack.co/transaction/initialize')
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer sk_test_fake')
      const sentBody = JSON.parse(String(init?.body ?? '{}')) as {
        email: string
        amount: number
        currency: string
        reference: string
        channels: string[]
        callback_url: string
        metadata: { custom_fields: Array<{ variable_name: string; value: string }> }
      }
      // Amount is in subunit (kobo) — 500 NGN → 50_000 kobo.
      expect(sentBody.amount).toBe(50_000)
      expect(sentBody.currency).toBe('NGN')
      expect(sentBody.email).toBe('tip@example.test')
      expect(sentBody.reference.startsWith('baobab-')).toBe(true)
      expect(sentBody.channels).toContain('mobile_money')
      expect(sentBody.channels).toContain('ussd')
      expect(sentBody.metadata.custom_fields.find((f) => f.variable_name === 'customer_name')?.value).toBe('Ada Lovelace')
      return new Response(
        JSON.stringify({
          status: true,
          data: { authorization_url: fakeLink, reference: sentBody.reference },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch
    globalThis.fetch = fetchMock

    const env = fakeEnv({
      PAYSTACK_SECRET_KEY: 'sk_test_fake',
      PAYSTACK_BASE_URL: 'https://api.paystack.co',
    })
    const r = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 500,
          currency: 'NGN',
          customer_email: 'tip@example.test',
          customer_name: 'Ada Lovelace',
        }),
      }),
      env,
    )
    expect(r.status).toBe(200)
    const body = (await r.json()) as { checkoutUrl: string; txRef: string }
    expect(body.checkoutUrl).toBe(fakeLink)
    expect(body.txRef.startsWith('baobab-')).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('falls back to the default base URL when PAYSTACK_BASE_URL is unset', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      expect(url).toBe('https://api.paystack.co/transaction/initialize')
      return new Response(JSON.stringify({ data: { authorization_url: 'https://x' } }), { status: 200 })
    }) as typeof fetch
    globalThis.fetch = fetchMock

    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_fake' })
    const r = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1, currency: 'NGN', customer_email: 'a@b.test' }),
      }),
      env,
    )
    expect(r.status).toBe(200)
  })

  it('returns 400 when amount is missing or non-positive', async () => {
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_fake' })

    const r = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: 'NGN', customer_email: 'a@b.test' }),
      }),
      env,
    )
    expect(r.status).toBe(400)

    const r2 = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 0, currency: 'NGN', customer_email: 'a@b.test' }),
      }),
      env,
    )
    expect(r2.status).toBe(400)
  })

  it('returns 400 when currency or email is missing', async () => {
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_fake' })

    const r = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100, customer_email: 'a@b.test' }),
      }),
      env,
    )
    expect(r.status).toBe(400)

    const r2 = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100, currency: 'NGN' }),
      }),
      env,
    )
    expect(r2.status).toBe(400)
  })

  it('returns 502 paystack_failed when the upstream call errors', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('{"status":false,"message":"bad key"}', { status: 401 }),
    ) as typeof fetch
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_fake' })
    const r = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100, currency: 'NGN', customer_email: 'a@b.test' }),
      }),
      env,
    )
    expect(r.status).toBe(502)
    const body = (await r.json()) as { error: string }
    expect(body.error).toBe('paystack_failed')
  })

  it('returns 502 paystack_no_link when the upstream omits authorization_url', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ data: {} }), { status: 200 }),
    ) as typeof fetch
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_fake' })
    const r = await payments.fetch(
      new Request('http://baobab/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100, currency: 'NGN', customer_email: 'a@b.test' }),
      }),
      env,
    )
    expect(r.status).toBe(502)
    const body = (await r.json()) as { error: string }
    expect(body.error).toBe('paystack_no_link')
  })
})

describe('GET /api/payments/verify/:txRef', () => {
  it('returns 503 when secret unset (via SELF.fetch)', async () => {
    const r = await SELF.fetch('http://baobab/api/payments/verify/baobab-test-2')
    expect(r.status).toBe(503)
  })

  it('returns the upstream transaction status with amount converted to major units', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      expect(url).toBe('https://api.paystack.co/transaction/verify/baobab-test-1')
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer sk_test_fake')
      // Paystack returns amount in subunit (kobo); 50_000 kobo = 500 NGN.
      return new Response(
        JSON.stringify({ data: { status: 'success', amount: 50_000, currency: 'NGN' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    const env = fakeEnv({
      PAYSTACK_SECRET_KEY: 'sk_test_fake',
      PAYSTACK_BASE_URL: 'https://api.paystack.co',
    })
    const r = await payments.fetch(
      new Request('http://baobab/verify/baobab-test-1'),
      env,
    )
    expect(r.status).toBe(200)
    const body = (await r.json()) as { status: string; amount?: number; currency?: string }
    expect(body.status).toBe('success')
    // Worker converts subunit → major unit for the client.
    expect(body.amount).toBe(500)
    expect(body.currency).toBe('NGN')
  })

  it('returns 502 verify_failed on upstream error', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('{"status":false}', { status: 401 }),
    ) as typeof fetch
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_fake' })
    const r = await payments.fetch(new Request('http://baobab/verify/baobab-x'), env)
    expect(r.status).toBe(502)
  })
})
