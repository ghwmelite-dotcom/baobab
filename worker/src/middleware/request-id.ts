import type { MiddlewareHandler } from 'hono'
import type { AppContext } from '../types'

// Generate or propagate an X-Request-Id. Honors an incoming header so
// upstream proxies/clients can correlate logs across hops; falls back to
// crypto.randomUUID otherwise. Always echoes the id back as a response
// header for support / log correlation.
export const requestId: MiddlewareHandler<AppContext> = async (c, next) => {
  const incoming = c.req.header('X-Request-Id')
  // Cap at 128 chars to avoid header-bomb DoS via attacker-controlled IDs.
  const id = (incoming && incoming.length <= 128) ? incoming : crypto.randomUUID()
  c.set('reqId', id)
  c.header('X-Request-Id', id)
  await next()
}
