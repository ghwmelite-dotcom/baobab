import { Hono } from 'hono'
import type { AppContext } from '../types'
import { generateCode, storeOtp, verifyOtp, recordOtpAttempt, getSendCount } from '../services/otp'
import { selectProviders } from '../services/otp/select'
import { normalizeEmail, normalizePhoneE164 } from '../lib/normalize'
import { newId, getUserByPhone, getUserByEmail, getUserById, insertUser } from '../lib/db'
import { startSession, endSession, rotateRefresh, bumpPasswordVersion } from '../lib/session'
import { hashPassword, verifyPassword } from '../lib/password'
import { verifyRefresh } from '../lib/jwt'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'

const SEND_LIMIT_PER_HOUR = 3

// Type-safe JSON body reader. Returns Partial<T> on parse failure rather
// than letting Hono's c.req.json throw — which would surface as a 500 via
// onError, when 400 is the right status for a malformed body.
async function readJson<T extends object>(req: { json(): Promise<unknown> }): Promise<Partial<T>> {
  try {
    const v = await req.json()
    return (v && typeof v === 'object' ? v : {}) as Partial<T>
  } catch {
    return {}
  }
}

// Narrow an unknown JSON body field to string. The Partial<T> typing on
// readJson lies about runtime — attackers can send `{ password: 12345 }`
// or `{ phone: ['+233...'] }` and the value will not be a string. Every
// route uses this to cleanly emit 400 instead of crashing into 500.
function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

// Translate D1 UNIQUE constraint failures from check-then-insert races into
// 409s. Anything else propagates and surfaces as 500 via onError.
function isUniqueViolation(e: unknown, column?: string): boolean {
  if (!(e instanceof Error)) return false
  const m = e.message
  if (column) return new RegExp(`UNIQUE constraint failed.*\\.${column}`).test(m)
  return /UNIQUE constraint failed/.test(m)
}

export const auth = new Hono<AppContext>()

// Per-IP rate limits. /otp/send already has a per-phone 3/hr quota; this is
// the IP-level brake on top. /login is the credential-stuffing surface — the
// 600k PBKDF2 cost is friction, but a rate limit ends the attack instead of
// just slowing it.
auth.use('/otp/*', rateLimit({ requests: 10, windowSec: 60, keyPrefix: 'auth-otp' }))
auth.use('/login',  rateLimit({ requests: 10, windowSec: 60, keyPrefix: 'auth-login' }))
auth.use('/signup', rateLimit({ requests: 10, windowSec: 60, keyPrefix: 'auth-signup' }))

auth.post('/otp/send', async (c) => {
  const body = await readJson<{ phone?: string }>(c.req)
  const phone = normalizePhoneE164(body.phone)
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
  const phone = normalizePhoneE164(body.phone)
  const code = asString(body.code)
  if (!phone || !code) return c.json({ error: 'phone and code required' }, 400)

  const ok = await verifyOtp(c.env.OTP, phone, code)
  if (!ok) return c.json({ error: 'invalid or expired code' }, 401)

  let user = await getUserByPhone(c.env.DB, phone)
  if (!user) {
    const id = newId()
    try {
      await insertUser(c.env.DB, { id, phone })
    } catch (e) {
      if (isUniqueViolation(e, 'phone')) {
        // Race: another concurrent /otp/verify won the insert. Re-read.
        user = await getUserByPhone(c.env.DB, phone)
      } else {
        throw e
      }
    }
    if (!user) user = await getUserById(c.env.DB, id)
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
  const email = normalizeEmail(body.email)
  const password = asString(body.password)
  const display_name = asString(body.display_name) ?? undefined
  if (!email) return c.json({ error: 'invalid email' }, 400)
  if (!password || password.length < 8) return c.json({ error: 'password too short' }, 400)

  const existing = await getUserByEmail(c.env.DB, email)
  if (existing) return c.json({ error: 'email already registered' }, 409)

  const id = newId()
  const password_hash = await hashPassword(password)
  try {
    await insertUser(c.env.DB, { id, email, password_hash, display_name })
  } catch (e) {
    if (isUniqueViolation(e, 'email')) {
      // Race: lost the check-then-insert window to a concurrent signup.
      return c.json({ error: 'email already registered' }, 409)
    }
    throw e
  }

  const tokens = await startSession(c.env, id)
  return c.json({
    ...tokens,
    user: { id, email, display_name },
  })
})

auth.post('/login', async (c) => {
  const body = await readJson<{ email?: string; password?: string }>(c.req)
  const email = normalizeEmail(body.email)
  const password = asString(body.password)
  // Uniform 401 message regardless of failure mode (no user enumeration).
  if (!email || !password) return c.json({ error: 'invalid credentials' }, 401)

  const user = await getUserByEmail(c.env.DB, email)
  if (!user || !user.password_hash) {
    // Burn comparable wall-clock time so attackers can't use response time to
    // probe for valid emails.
    await hashPassword(password).catch(() => null)
    return c.json({ error: 'invalid credentials' }, 401)
  }

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return c.json({ error: 'invalid credentials' }, 401)

  const tokens = await startSession(c.env, user.id)
  return c.json({
    ...tokens,
    user: { id: user.id, email: user.email, display_name: user.display_name },
  })
})

auth.post('/refresh', async (c) => {
  const body = await readJson<{ refresh?: string }>(c.req)
  const refresh = asString(body.refresh)
  if (!refresh) return c.json({ error: 'refresh required' }, 400)

  let claims
  try {
    claims = await verifyRefresh(c.env.AUTH_SECRET, refresh)
  } catch {
    return c.json({ error: 'invalid refresh' }, 401)
  }

  const tokens = await rotateRefresh(c.env, claims.jti, claims.sub)
  if (!tokens) return c.json({ error: 'refresh already rotated or revoked' }, 401)
  return c.json(tokens)
})

auth.post('/logout', authMiddleware, async (c) => {
  // authMiddleware set c.var.jti to the verified access-token jti.
  // endSession revokes BOTH the access record and its paired refresh
  // record so a logged-out token can't /refresh back into use.
  const jti = c.get('jti')
  if (jti) await endSession(c.env, jti)
  return c.json({ ok: true })
})

auth.get('/me', authMiddleware, async (c) => {
  const user = await getUserById(c.env.DB, c.get('userId')!)
  if (!user) return c.json({ error: 'not found' }, 404)
  // Never leak password_hash to the client.
  const { password_hash: _omit, ...safe } = user
  return c.json(safe)
})

// Allowlisted fields for PUT /settings — explicitly excludes password_hash,
// id, created_at, phone, email, is_active, etc. to prevent privilege
// escalation via arbitrary column updates.
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
  const current = asString(body.current)
  const next = asString(body.next)
  if (!current || !next || next.length < 8) return c.json({ error: 'invalid request' }, 400)

  const userId = c.get('userId')!
  const user = await getUserById(c.env.DB, userId)
  if (!user || !user.password_hash) return c.json({ error: 'no password set' }, 400)
  const ok = await verifyPassword(current, user.password_hash)
  if (!ok) return c.json({ error: 'wrong current password' }, 401)

  const nextHash = await hashPassword(next)
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?').bind(nextHash, user.id).run()

  // Bump the password-version sentinel: any access/refresh token issued
  // BEFORE this moment will be rejected by authMiddleware on next use,
  // even though its JWT signature is still valid. This is the OWASP
  // ASVS 3.5.7 invariant — password change invalidates active sessions.
  await bumpPasswordVersion(c.env, userId)

  return c.json({ ok: true })
})
