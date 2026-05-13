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
      // Worker-hosted callback page. Derived from the request origin so it
      // works for any deployment host (production worker, preview, local
      // miniflare) without needing the `baobab.africa` apex domain to
      // resolve.
      callback_url: `${new URL(c.req.url).origin}/api/payments/callback`,
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

// Paystack webhook receiver.
//
// Paystack POSTs events to this endpoint (URL configured in their dashboard:
// Settings → API Keys & Webhooks → Webhook URL). Every request carries an
// `x-paystack-signature` header — HMAC-SHA512 of the raw request body keyed
// by our PAYSTACK_SECRET_KEY. We verify before trusting the body.
//
// Successful charges land in the `payment_events` table for downstream
// processing (thank-you emails, tip leaderboards, etc.). Failed/abandoned
// charges are logged too — useful for audit.
payments.post('/webhook', async (c) => {
  const secret = c.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    // We must still 200 OK so Paystack doesn't retry indefinitely. Log
    // server-side that we received a webhook while unconfigured.
    console.warn('payment.webhook.unconfigured: dropping event (PAYSTACK_SECRET_KEY unset)')
    return c.json({ ok: true, note: 'unconfigured' })
  }

  const signature = c.req.header('x-paystack-signature')
  if (!signature) return c.json({ error: 'missing_signature' }, 400)

  // Read the RAW body — must not be JSON-parsed before signature check.
  const rawBody = await c.req.text()

  // HMAC-SHA512 via WebCrypto.
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const computed = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')

  if (computed !== signature.toLowerCase()) {
    console.warn('payment.webhook.signature_mismatch')
    return c.json({ error: 'invalid_signature' }, 401)
  }

  let event: {
    event?: string
    data?: {
      id?: number
      reference?: string
      status?: string
      amount?: number
      currency?: string
      customer?: { email?: string }
    }
  }
  try {
    event = JSON.parse(rawBody) as typeof event
  } catch {
    return c.json({ error: 'invalid_json' }, 400)
  }

  const eventType = event.event ?? 'unknown'
  const data = event.data ?? {}
  const txRef = data.reference ?? ''
  if (!txRef) return c.json({ error: 'missing_reference' }, 400)

  const id = `pe_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
  await c.env.DB
    .prepare(
      `INSERT INTO payment_events
        (id, tx_ref, paystack_id, event_type, status, amount_subunit, currency, customer_email, raw_event, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      txRef,
      data.id ?? null,
      eventType,
      data.status ?? 'unknown',
      data.amount ?? null,
      data.currency ?? null,
      data.customer?.email ?? null,
      rawBody,
      Date.now(),
    )
    .run()

  return c.json({ ok: true })
})

// Post-payment thank-you page.
//
// Paystack redirects the user here after checkout completes (the
// `callback_url` set in /intent). We don't verify the transaction here —
// the user might be offline at redirect time, and the source of truth for
// settlement is the webhook event we'll have already received. This page
// is purely a "you can close this tab" affordance.
payments.get('/callback', async (c) => {
  // Paystack sometimes sends both `reference` and `trxref` — accept either.
  const reference = c.req.query('reference') ?? c.req.query('trxref') ?? ''
  // Strip any non-alphanumeric/underscore/dash characters to prevent HTML
  // injection in the rendered reference label. Cap at 64 chars (our refs
  // are well under that — `baobab-<ts>-<8-hex>` ~= 28 chars).
  const safeRef = reference.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Tip received — Baobab</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..700&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; background:
      radial-gradient(60% 50% at 50% 20%, rgba(217,119,6,0.18) 0%, rgba(0,0,0,0) 60%),
      linear-gradient(180deg, #1a120a 0%, #0e0905 100%);
      color: #f5ede0; font-family: 'Bookman Old Style', Georgia, serif;
      display: flex; align-items: center; justify-content: center;
      padding: 48px 24px; }
    .card { max-width: 480px; text-align: center; }
    h1 { font-family: 'Fraunces', Georgia, serif; font-size: 56px; font-weight: 600;
      margin: 0 0 16px; letter-spacing: -0.02em;
      background-image: linear-gradient(108deg, #f5ede0 0%, #f5ede0 55%, #fbbf24 92%);
      -webkit-background-clip: text; background-clip: text; color: transparent; }
    p { color: #d4cfc5; font-size: 16px; line-height: 1.6; margin: 0 0 12px; }
    .ref { font-family: 'JetBrains Mono', Menlo, monospace; font-size: 12px;
      color: #948d83; margin-top: 32px; }
    .leaf { display: inline-block; width: 12px; height: 12px; border-radius: 50%;
      background: #d97706; margin-right: 6px; vertical-align: middle;
      animation: pulse 2.4s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
    @media (prefers-reduced-motion: reduce) {
      .leaf { animation: none; }
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Thank you.</h1>
    <p><span class="leaf"></span>Your tip is on its way to keeping Baobab growing.</p>
    <p>You can close this tab.</p>
    ${safeRef ? `<p class="ref">Reference: ${safeRef}</p>` : ''}
  </main>
</body>
</html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
})

export default payments
