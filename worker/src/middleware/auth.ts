import type { MiddlewareHandler } from 'hono'
import { verifyAccess } from '../lib/jwt'
import type { AppContext } from '../types'

export const authMiddleware: MiddlewareHandler<AppContext> = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401)
  const token = auth.slice(7)

  const cached = await c.env.SESSIONS.get(`access:${token}`)
  if (cached) {
    c.set('userId', cached)
    return next()
  }

  try {
    const { sub } = await verifyAccess(c.env.AUTH_SECRET, token)
    await c.env.SESSIONS.put(`access:${token}`, sub, { expirationTtl: 300 })
    c.set('userId', sub)
    return next()
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
}
