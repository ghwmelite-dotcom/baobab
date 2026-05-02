import type { MiddlewareHandler } from 'hono'
import { verifyAccess } from '../lib/jwt'
import { getPasswordVersion } from '../lib/session'
import type { AppContext } from '../types'

// jti-keyed session model:
//   - Login route stores `session:${jti}` in SESSIONS KV with TTL = ACCESS_TTL_SEC.
//   - This middleware verifies the JWT (sig, exp, iss, aud, alg) THEN confirms
//     the session record still exists. Logout / "sign out everywhere" delete
//     the relevant session keys, instantly invalidating tokens regardless of
//     their JWT TTL.
//   - Password change bumps `pwv:${userId}` to current ms-timestamp. Any token
//     whose JWT iat predates that bump is rejected here, enforcing OWASP ASVS
//     3.5.7 (password change invalidates active sessions) without scanning
//     KV for per-user session indexes.
//   - No raw-token caching: the SESSIONS KV reads ARE the revocation checks.

export const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401)
  const token = auth.slice(7).trim()
  if (!token) return c.json({ error: 'unauthorized' }, 401)

  let claims
  try {
    claims = await verifyAccess(c.env.AUTH_SECRET, token)
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }

  const session = await c.env.SESSIONS.get(`session:${claims.jti}`)
  if (!session) return c.json({ error: 'session revoked' }, 401)

  // Password-version check — reject tokens issued before the user's last
  // password change. iat is in seconds; pwv is in ms.
  const pwv = await getPasswordVersion(c.env, claims.sub)
  if (pwv !== null && claims.iat * 1000 < pwv) {
    return c.json({ error: 'session invalidated' }, 401)
  }

  c.set('userId', claims.sub)
  c.set('jti', claims.jti)
  await next()
}
