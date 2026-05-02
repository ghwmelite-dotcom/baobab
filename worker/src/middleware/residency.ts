import type { MiddlewareHandler } from 'hono'
import { isAfricanColo } from '../lib/colos'
import type { AppContext } from '../types'

export const residency: MiddlewareHandler<AppContext> = async (c, next) => {
  const cf = c.req.raw.cf as { colo?: string; country?: string } | undefined
  const colo = cf?.colo ?? 'unknown'
  const region = colo === 'unknown' ? 'unknown' : isAfricanColo(colo) ? 'africa' : 'edge-fallback'

  c.header('X-Baobab-Colo', colo)
  c.header('X-Baobab-Region', region)
  c.header('X-Data-Residency', 'd1=weur,r2=eu')

  await next()
}
