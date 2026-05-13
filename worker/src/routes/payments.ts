import { Hono } from 'hono'
import type { AppContext } from '../types'

// Paystack payment-link API.
//
// Paystack's hosted checkout takes a POST to `/transaction/initialize` with a
// merchant-generated `reference`. The response includes `data.authorization_url`
// — the URL we pop in a new tab. Status is later confirmed via
// `/transaction/verify/:reference`. Amounts are passed in the SUBUNIT
// (kobo for NGN, pesewas for GHS, cents for ZAR/KES/USD) — we multiply by 100.
//
// All routes guard on PAYSTACK_SECRET_KEY: when unset (alpha default), we
// return 503 `payments_unconfigured` so the desktop widget can render a
// "coming soon" message instead of a 5xx.

const DEFAULT_BASE_URL = 'https://api.paystack.co'

interface IntentBody {
  amount?: unknown
  currency?: unknown
  customer_email?: unknown
  customer_name?: unknown
}

async function readJson<T extends object>(req: { json(): Promise<unknown> }): Promise<Partial<T>> {
  try {
    const v = await req.json()
    return (v && typeof v === 'object' ? v : {}) as Partial<T>
  } catch {
    return {}
  }
}

export const payments = new Hono<AppContext>()

payments.post('/intent', async (c) => {
  const body = await readJson<IntentBody>(c.req)
  const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount)
  const currency = typeof body.currency === 'string' ? body.currency : null
  const customerEmail = typeof body.customer_email === 'string' ? body.customer_email : null
  const customerName = typeof body.customer_name === 'string' ? body.customer_name : null

  if (!Number.isFinite(amount) || amount <= 0) {
    return c.json({ error: 'amount must be > 0' }, 400)
  }
  if (!currency) return c.json({ error: 'currency required' }, 400)
  if (!customerEmail) return c.json({ error: 'customer_email required' }, 400)

  const secret = c.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return c.json(
      {
        error: 'payments_unconfigured',
        message:
          'Paystack keys are not set on this worker. Set PAYSTACK_SECRET_KEY via wrangler secret.',
      },
      503,
    )
  }

  const reference = `baobab-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const baseUrl = c.env.PAYSTACK_BASE_URL ?? DEFAULT_BASE_URL
  // Paystack accepts amount in subunit (kobo/pesewas/cents). Round to handle
  // floating-point drift on amounts like 9.99.
  const amountSubunit = Math.round(amount * 100)

  const res = await fetch(`${baseUrl}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: customerEmail,
      amount: amountSubunit,
      currency,
      reference,
      // Channels — pass-through; Paystack auto-filters by currency support
      // (e.g. mobile_money only applies to GHS/KES, ussd/bank_transfer to NGN).
      channels: ['card', 'bank', 'ussd', 'mobile_money', 'bank_transfer', 'qr'],
      // Placeholder — once we ship a public landing page this becomes
      // https://baobab.africa/payments/callback?reference=...
      callback_url: 'https://baobab.africa/payments/callback',
      metadata: {
        custom_fields: [
          { display_name: 'Customer', variable_name: 'customer_name', value: customerName ?? 'Baobab Supporter' },
          { display_name: 'Source', variable_name: 'source', value: 'baobab-desktop' },
        ],
      },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    return c.json({ error: 'paystack_failed', detail: errBody }, 502)
  }

  const data = (await res.json()) as { data?: { authorization_url?: string; reference?: string } }
  const checkoutUrl = data?.data?.authorization_url
  if (!checkoutUrl) return c.json({ error: 'paystack_no_link' }, 502)
  // Echo whichever reference Paystack returns (in case they normalize ours).
  const finalRef = data?.data?.reference ?? reference
  return c.json({ checkoutUrl, txRef: finalRef })
})

payments.get('/verify/:txRef', async (c) => {
  const txRef = c.req.param('txRef')
  const secret = c.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return c.json({ error: 'payments_unconfigured' }, 503)
  }
  const baseUrl = c.env.PAYSTACK_BASE_URL ?? DEFAULT_BASE_URL
  const res = await fetch(`${baseUrl}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
  if (!res.ok) return c.json({ error: 'verify_failed' }, 502)
  const data = (await res.json()) as {
    data?: { status?: string; amount?: number; currency?: string }
  }
  // Paystack returns amount in subunit. Convert back to the major unit so the
  // client doesn't have to know about the kobo/cent split.
  const amountSubunit = data?.data?.amount
  const amountMajor = typeof amountSubunit === 'number' ? amountSubunit / 100 : undefined
  return c.json({
    status: data?.data?.status ?? 'unknown',
    amount: amountMajor,
    currency: data?.data?.currency,
  })
})

export default payments
