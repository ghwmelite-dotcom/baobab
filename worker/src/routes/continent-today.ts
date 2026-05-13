import { Hono } from 'hono'
import type { AppContext } from '../types'
import { assembleDigest } from '../services/digest'

// Continent Today — daily AI-summarized digest of African news. Open endpoint
// (no auth) so the NTP can populate without forcing sign-in. KV-cached for
// 12h inside assembleDigest, so request fan-out is bounded.
export const continentToday = new Hono<AppContext>()

continentToday.get('/', async (c) => {
  try {
    const items = await assembleDigest(c.env)
    return c.json({ items })
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      route: '/api/continent-today',
      message: err instanceof Error ? err.message : String(err),
    }))
    return c.json({ items: [], error: 'unavailable' }, 503)
  }
})

export default continentToday
