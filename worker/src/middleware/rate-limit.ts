import type { MiddlewareHandler } from 'hono'
import type { AppContext } from '../types'

export interface RateLimitOpts {
  requests: number    // max requests per window
  windowSec: number   // window length in seconds
  keyPrefix: string   // namespace — prevents cross-route bucket collisions
}

// Fixed-bucket rate limiter on KV (despite the "sliding-window" framing in
// the plan, we use bucket = floor(now / window) which is technically fixed
// — at a window boundary a client can fire 2× the limit in close succession.
// Acceptable for P0; for stricter guarantees use a Durable Object or a
// proper sliding-window algorithm with per-request timestamp lists.
//
// Race condition: KV has no compare-and-swap, so concurrent get→put can lose
// increments. Each lost increment effectively raises the limit by one for
// that bucket. Acceptable trade-off for P0.

export function rateLimit(opts: RateLimitOpts): MiddlewareHandler<AppContext> {
  return async (c, next) => {
    // Prefer userId (post-auth) so logged-in users aren't punished for sharing
    // an office NAT; fall back to IP for unauthenticated traffic.
    const userId = c.get('userId')
    const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
    const id = userId ?? `ip:${ip}`

    const nowSec = Math.floor(Date.now() / 1000)
    const bucket = Math.floor(nowSec / opts.windowSec)
    const key = `rl:${opts.keyPrefix}:${id}:${bucket}`

    const raw = await c.env.RATE_LIMITS.get(key)
    const count = raw ? Number(raw) + 1 : 1

    if (count > opts.requests) {
      const reset = (bucket + 1) * opts.windowSec
      c.header('X-RateLimit-Limit', String(opts.requests))
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', String(reset))
      c.header('Retry-After', String(Math.max(1, reset - nowSec)))
      return c.json({ error: 'rate limited' }, 429)
    }

    // Sync put (NOT waitUntil): a fast follow-up request must observe this
    // increment, otherwise the limit is leaky. TTL = 2× window so adjacent
    // bucket boundaries don't lose state.
    await c.env.RATE_LIMITS.put(key, String(count), { expirationTtl: opts.windowSec * 2 })

    c.header('X-RateLimit-Limit', String(opts.requests))
    c.header('X-RateLimit-Remaining', String(opts.requests - count))
    await next()
  }
}
