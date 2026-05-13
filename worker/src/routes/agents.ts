import { Hono } from 'hono'
import type { AppContext } from '../types'
import { runBureaucracy } from '../agents/bureaucracy'

export const agents = new Hono<AppContext>()

// Vertical AI agents. Unauthenticated for the alpha — these are pure
// inference endpoints that touch no per-user data, mirroring the translate
// route. Per-request cost is bounded by Workers AI rate limits at the edge.
agents.post('/bureaucracy', async (c) => {
  const body = await c.req.json<{ query?: string }>()
  const query = body.query?.trim()
  if (!query) return c.json({ error: 'query required' }, 400)
  try {
    const answer = await runBureaucracy(c.env, query)
    return c.json({ answer })
  } catch (e) {
    return c.json({ error: 'agent_failed', detail: String(e) }, 500)
  }
})

export default agents
