import { Hono } from 'hono'
import type { AppContext } from '../types'

// Flutterwave payment-link API.
//
// Flutterwave's "Standard" hosted checkout takes a POST to `/payments` with a
// merchant-generated `tx_ref`. The response includes `data.link` — the URL we
// pop in a new tab. Status is later confirmed via `/transactions/verify_by_reference`.
//
// All routes guard on FLUTTERWAVE_SECRET_KEY: when unset (alpha default), we
// return 503 `payments_unconfigured` so the desktop widget can render a
// "coming soon" message instead of a 5xx.

const DEFAULT_BASE_URL = 'https://api.flutterwave.com/v3'

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

  const secret = c.env.FLUTTERWAVE_SECRET_KEY
  if (!secret) {
    return c.json(
      {
        error: 'payments_unconfigured',
        message:
          'Flutterwave keys are not set on this worker. Set FLUTTERWAVE_SECRET_KEY via wrangler secret.',
      },
      503,
    )
  }

  const txRef = `baobab-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const baseUrl = c.env.FLUTTERWAVE_BASE_URL ?? DEFAULT_BASE_URL

  const res = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency,
      payment_options: 'card,mobilemoney,ussd,mpesa,banktransfer',
      // Placeholder — once we ship a public landing page this becomes
      // https://baobab.africa/payments/callback?tx_ref=...
      redirect_url: 'https://baobab.africa/payments/callback',
      customer: {
        email: customerEmail,
        name: customerName ?? 'Baobab Supporter',
      },
      customizations: {
        title: 'Tip Baobab',
        description: 'Support the African AI browser',
      },
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    return c.json({ error: 'flutterwave_failed', detail: errBody }, 502)
  }

  const data = (await res.json()) as { data?: { link?: string } }
  const checkoutUrl = data?.data?.link
  if (!checkoutUrl) return c.json({ error: 'flutterwave_no_link' }, 502)
  return c.json({ checkoutUrl, txRef })
})

payments.get('/verify/:txRef', async (c) => {
  const txRef = c.req.param('txRef')
  const secret = c.env.FLUTTERWAVE_SECRET_KEY
  if (!secret) {
    return c.json({ error: 'payments_unconfigured' }, 503)
  }
  const baseUrl = c.env.FLUTTERWAVE_BASE_URL ?? DEFAULT_BASE_URL
  const res = await fetch(
    `${baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
    },
  )
  if (!res.ok) return c.json({ error: 'verify_failed' }, 502)
  const data = (await res.json()) as {
    data?: { status?: string; amount?: number; currency?: string }
  }
  return c.json({
    status: data?.data?.status ?? 'unknown',
    amount: data?.data?.amount,
    currency: data?.data?.currency,
  })
})

export default payments
