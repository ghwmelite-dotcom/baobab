import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { SELF } from 'cloudflare:test'
import { createHmac } from 'node:crypto'
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
      // callback_url is now derived from the worker host (the request origin)
      // so Paystack redirects users to a real worker-hosted page rather than
      // the previous placeholder baobab.africa URL.
      expect(sentBody.callback_url.endsWith('/api/payments/callback')).toBe(true)
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

// Helper: build a minimal D1Database-shaped mock that records the bindings
// passed to the prepared INSERT statement. The route only chains
// `.prepare(sql).bind(...args).run()`, so we expose those three methods.
function mockDB(): {
  db: Env['DB']
  prepareSpy: ReturnType<typeof vi.fn>
  bindSpy: ReturnType<typeof vi.fn>
  runSpy: ReturnType<typeof vi.fn>
} {
  const runSpy = vi.fn(async () => ({ success: true, meta: {}, results: [] }))
  const bindSpy = vi.fn(() => ({ run: runSpy }))
  const prepareSpy = vi.fn(() => ({ bind: bindSpy }))
  const db = { prepare: prepareSpy } as unknown as Env['DB']
  return { db, prepareSpy, bindSpy, runSpy }
}

describe('POST /api/payments/webhook', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns 200 ok with note when no secret is bound (unconfigured)', async () => {
    // No PAYSTACK_SECRET_KEY → Paystack must not retry, so we 200 OK and
    // log a note. Verified via SELF.fetch which uses the test runtime env
    // (secret unbound by default).
    const r = await SELF.fetch('http://baobab/api/payments/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'charge.success', data: { reference: 'ref1' } }),
    })
    expect(r.status).toBe(200)
    const body = (await r.json()) as { ok: boolean; note?: string }
    expect(body.ok).toBe(true)
    expect(body.note).toBe('unconfigured')
  })

  it('returns 400 when x-paystack-signature header is missing', async () => {
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_webhook', DB: mockDB().db })
    const r = await payments.fetch(
      new Request('http://baobab/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'charge.success', data: { reference: 'ref1' } }),
      }),
      env,
    )
    expect(r.status).toBe(400)
    const body = (await r.json()) as { error: string }
    expect(body.error).toBe('missing_signature')
  })

  it('rejects an invalid HMAC signature with 401', async () => {
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: 'sk_test_webhook', DB: mockDB().db })
    const r = await payments.fetch(
      new Request('http://baobab/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': 'deadbeef'.repeat(16),
        },
        body: JSON.stringify({ event: 'charge.success', data: { reference: 'ref1' } }),
      }),
      env,
    )
    expect(r.status).toBe(401)
    const body = (await r.json()) as { error: string }
    expect(body.error).toBe('invalid_signature')
  })

  it('logs the event to payment_events when the signature is valid', async () => {
    const secret = 'sk_test_webhook'
    const rawBody = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 9876543,
        reference: 'baobab-test-webhook-1',
        status: 'success',
        amount: 50_000,
        currency: 'NGN',
        customer: { email: 'tip@example.test' },
      },
    })
    const sig = createHmac('sha512', secret).update(rawBody).digest('hex')
    const { db, prepareSpy, bindSpy, runSpy } = mockDB()
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: secret, DB: db })

    const r = await payments.fetch(
      new Request('http://baobab/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: rawBody,
      }),
      env,
    )

    expect(r.status).toBe(200)
    const body = (await r.json()) as { ok: boolean }
    expect(body.ok).toBe(true)

    expect(prepareSpy).toHaveBeenCalledOnce()
    const firstPrepare = prepareSpy.mock.calls[0] as unknown[] | undefined
    const sql = (firstPrepare?.[0] ?? '') as string
    expect(sql).toContain('INSERT INTO payment_events')

    expect(bindSpy).toHaveBeenCalledOnce()
    const bindings = (bindSpy.mock.calls[0] ?? []) as unknown[]
    // Bindings order: id, tx_ref, paystack_id, event_type, status,
    // amount_subunit, currency, customer_email, raw_event, received_at.
    expect(bindings[1]).toBe('baobab-test-webhook-1') // tx_ref
    expect(bindings[2]).toBe(9876543) // paystack_id
    expect(bindings[3]).toBe('charge.success') // event_type
    expect(bindings[4]).toBe('success') // status
    expect(bindings[5]).toBe(50_000) // amount_subunit
    expect(bindings[6]).toBe('NGN') // currency
    expect(bindings[7]).toBe('tip@example.test') // customer_email
    expect(bindings[8]).toBe(rawBody) // raw_event

    expect(runSpy).toHaveBeenCalledOnce()
  })

  it('returns 400 when the verified body has no reference', async () => {
    const secret = 'sk_test_webhook'
    const rawBody = JSON.stringify({ event: 'charge.success', data: {} })
    const sig = createHmac('sha512', secret).update(rawBody).digest('hex')
    const env = fakeEnv({ PAYSTACK_SECRET_KEY: secret, DB: mockDB().db })
    const r = await payments.fetch(
      new Request('http://baobab/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: rawBody,
      }),
      env,
    )
    expect(r.status).toBe(400)
    const body = (await r.json()) as { error: string }
    expect(body.error).toBe('missing_reference')
  })
})

describe('GET /api/payments/callback', () => {
  it('returns an HTML thank-you page with the reference', async () => {
    const r = await SELF.fetch('http://baobab/api/payments/callback?reference=baobab-test-1')
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/html')
    const body = await r.text()
    expect(body).toContain('Thank you')
    expect(body).toContain('baobab-test-1')
  })

  it('accepts trxref as an alternative to reference', async () => {
    const r = await SELF.fetch('http://baobab/api/payments/callback?trxref=baobab-trx-2')
    expect(r.status).toBe(200)
    const body = await r.text()
    expect(body).toContain('baobab-trx-2')
  })

  it('renders without a reference label when none is provided', async () => {
    const r = await SELF.fetch('http://baobab/api/payments/callback')
    expect(r.status).toBe(200)
    const body = await r.text()
    expect(body).toContain('Thank you')
    expect(body).not.toContain('Reference:')
  })

  it('sanitizes the reference parameter to prevent HTML injection', async () => {
    const r = await SELF.fetch(
      'http://baobab/api/payments/callback?reference=<script>alert(1)</script>',
    )
    const body = await r.text()
    expect(body).not.toContain('<script>')
    expect(body).not.toContain('alert(1)')
  })
})
