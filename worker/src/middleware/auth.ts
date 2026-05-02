import type { MiddlewareHandler } from 'hono'
import { verifyAccess } from '../lib/jwt'
import type { AppContext } from '../types'

// jti-keyed session model:
//   - Login route stores `session:${jti}` in SESSIONS KV with TTL = ACCESS_TTL_SEC.
//   - This middleware verifies the JWT (sig, exp, iss, aud, alg) THEN confirms
//     the session record still exists. Logout / password reset / "sign out
//     everywhere" delete the relevant session keys, instantly invalidating
//     tokens regardless of their JWT TTL.
//   - No raw-token caching: the SESSIONS KV read IS the revocation check, and
//     paying ~5-30ms per request for that read is the right trade-off for the
//     security guarantee. If hot-path latency becomes an issue, add a short-TTL
//     hash-keyed cache here, but be explicit about the resulting revocation
//     latency window.

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

  c.set('userId', claims.sub)
  await next()
}
