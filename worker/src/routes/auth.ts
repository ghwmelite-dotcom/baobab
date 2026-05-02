import { Hono } from 'hono'
import type { AppContext } from '../types'
import { generateCode, storeOtp, verifyOtp, recordOtpAttempt, getSendCount } from '../services/otp'
import { selectProviders } from '../services/otp/select'
import { normalizePhoneE164 } from '../lib/normalize'
import { newId, getUserByPhone, getUserByEmail, getUserById, insertUser } from '../lib/db'
import { startSession, endAccessSession, rotateRefresh } from '../lib/session'
import { hashPassword, verifyPassword } from '../lib/password'
import { normalizeEmail } from '../lib/normalize'
import { verifyRefresh } from '../lib/jwt'
import { authMiddleware } from '../middleware/auth'

const SEND_LIMIT_PER_HOUR = 3

// Type-safe JSON body reader. Returns Partial<T> on parse failure rather
// than letting Hono's c.req.json throw — which would surface as a 500 via
// onError, when 400 is the right status for a malformed body. Partial<T>
// (T already optional-fielded) keeps narrowing usable downstream.
async function readJson<T extends object>(req: { json(): Promise<unknown> }): Promise<Partial<T>> {
  try {
    const v = await req.json()
    return (v && typeof v === 'object' ? v : {}) as Partial<T>
  } catch {
    return {}
  }
}

export const auth = new Hono<AppContext>()

auth.post('/otp/send', async (c) => {
  const body = await readJson<{ phone?: string }>(c.req)
  const phone = body.phone ? normalizePhoneE164(body.phone) : null
  if (!phone) return c.json({ error: 'invalid phone' }, 400)

  const sent = await getSendCount(c.env.OTP, phone)
  if (sent >= SEND_LIMIT_PER_HOUR) return c.json({ error: 'too many requests' }, 429)

  const code = generateCode()
  await storeOtp(c.env.OTP, phone, code)
  await recordOtpAttempt(c.env.OTP, phone)

  const providers = selectProviders(c.env, phone)
  if (providers.length === 0) {
    if (c.env.ENVIRONMENT === 'development') {
      console.log(`[dev] OTP for ${phone}: ${code}`)
      return c.json({ ok: true, dev_code: code })
    }
    return c.json({ error: 'no provider configured' }, 500)
  }

  const message = `Your Baobab code: ${code}. Valid 5 minutes.`
  for (const p of providers) {
    const r = await p.send(phone, message)
    if (r.ok) return c.json({ ok: true, provider: p.name })
  }
  return c.json({ error: 'all providers failed' }, 502)
})

auth.post('/otp/verify', async (c) => {
  const body = await readJson<{ phone?: string; code?: string }>(c.req)
  const phone = body.phone ? normalizePhoneE164(body.phone) : null
  if (!phone || !body.code) return c.json({ error: 'phone and code required' }, 400)

  const ok = await verifyOtp(c.env.OTP, phone, body.code)
  if (!ok) return c.json({ error: 'invalid or expired code' }, 401)

  let user = await getUserByPhone(c.env.DB, phone)
  if (!user) {
    const id = newId()
    await insertUser(c.env.DB, { id, phone })
    user = await getUserById(c.env.DB, id)
  }
  if (!user) return c.json({ error: 'user lookup failed' }, 500)

  const tokens = await startSession(c.env, user.id)
  return c.json({
    ...tokens,
    user: { id: user.id, phone: user.phone, display_name: user.display_name },
  })
})

auth.post('/signup', async (c) => {
  const body = await readJson<{ email?: string; password?: string; display_name?: string }>(c.req)
  const email = body.email ? normalizeEmail(body.email) : null
  if (!email) return c.json({ error: 'invalid email' }, 400)
  if (!body.password || body.password.length < 8) return c.json({ error: 'password too short' }, 400)

  const existing = await getUserByEmail(c.env.DB, email)
  if (existing) return c.json({ error: 'email already registered' }, 409)

  const id = newId()
  const password_hash = await hashPassword(body.password)
  await insertUser(c.env.DB, { id, email, password_hash, display_name: body.display_name })

  const tokens = await startSession(c.env, id)
  return c.json({
    ...tokens,
    user: { id, email, display_name: body.display_name },
  })
})

auth.post('/login', async (c) => {
  const body = await readJson<{ email?: string; password?: string }>(c.req)
  const email = body.email ? normalizeEmail(body.email) : null
  // Always burn ~600k iterations even on miss to avoid timing-based user
  // enumeration. The 401 reason is uniformly 'invalid credentials'.
  if (!email || !body.password) return c.json({ error: 'invalid credentials' }, 401)

  const user = await getUserByEmail(c.env.DB, email)
  if (!user || !user.password_hash) {
    // Burn comparable wall-clock time so attackers can't use response time to
    // probe for valid emails.
    await hashPassword(body.password).catch(() => null)
    return c.json({ error: 'invalid credentials' }, 401)
  }

  const ok = await verifyPassword(body.password, user.password_hash)
  if (!ok) return c.json({ error: 'invalid credentials' }, 401)

  const tokens = await startSession(c.env, user.id)
  return c.json({
    ...tokens,
    user: { id: user.id, email: user.email, display_name: user.display_name },
  })
})

auth.post('/refresh', async (c) => {
  const body = await readJson<{ refresh?: string }>(c.req)
  if (!body.refresh) return c.json({ error: 'refresh required' }, 400)

  let claims
  try {
    claims = await verifyRefresh(c.env.AUTH_SECRET, body.refresh)
  } catch {
    return c.json({ error: 'invalid refresh' }, 401)
  }

  const tokens = await rotateRefresh(c.env, claims.jti, claims.sub)
  if (!tokens) return c.json({ error: 'refresh already rotated or revoked' }, 401)
  return c.json(tokens)
})

auth.post('/logout', authMiddleware, async (c) => {
  // authMiddleware sets c.var.jti to the verified access-token jti.
  const jti = c.get('jti')
  if (jti) await endAccessSession(c.env, jti)
  return c.json({ ok: true })
})

auth.get('/me', authMiddleware, async (c) => {
  const user = await getUserById(c.env.DB, c.get('userId')!)
  if (!user) return c.json({ error: 'not found' }, 404)
  return c.json(user)
})

// Allowlisted fields for PUT /settings — explicitly excludes password_hash,
// id, created_at, phone, email, etc. to prevent privilege escalation via
// arbitrary column updates.
const SETTINGS_FIELDS = [
  'display_name', 'avatar_url', 'default_model', 'theme', 'ad_blocking', 'privacy_mode',
  'low_bandwidth_mode', 'search_engine', 'language', 'country', 'sidebar_position',
  'ai_provider', 'ai_provider_url',
] as const

auth.put('/settings', authMiddleware, async (c) => {
  const body = await readJson<Record<string, unknown>>(c.req)
  const sets: string[] = []
  const vals: unknown[] = []
  for (const f of SETTINGS_FIELDS) {
    if (f in body) {
      sets.push(`${f} = ?`)
      vals.push(body[f])
    }
  }
  if (sets.length === 0) return c.json({ error: 'no fields to update' }, 400)
  sets.push('updated_at = unixepoch()')
  vals.push(c.get('userId'))
  await c.env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
  return c.json({ ok: true })
})

auth.put('/password', authMiddleware, async (c) => {
  const body = await readJson<{ current?: string; next?: string }>(c.req)
  if (!body.current || !body.next || body.next.length < 8) return c.json({ error: 'invalid request' }, 400)
  const user = await getUserById(c.env.DB, c.get('userId')!)
  if (!user || !user.password_hash) return c.json({ error: 'no password set' }, 400)
  const ok = await verifyPassword(body.current, user.password_hash)
  if (!ok) return c.json({ error: 'wrong current password' }, 401)
  const next = await hashPassword(body.next)
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?').bind(next, user.id).run()
  return c.json({ ok: true })
})
