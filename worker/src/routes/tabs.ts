import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { newId } from '../lib/db'
import type { AppContext } from '../types'

export const tabs = new Hono<AppContext>()
tabs.use('*', authMiddleware)

tabs.get('/', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM tabs WHERE user_id = ? ORDER BY position')
    .bind(c.get('userId')).all()
  return c.json({ items: r.results ?? [] })
})

tabs.put('/sync', async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json<{
    tabs: Array<{ url: string; title?: string; favicon_url?: string; position: number; is_pinned?: number; is_active?: number }>
  }>()
  if (!Array.isArray(body.tabs)) return c.json({ error: 'tabs[] required' }, 400)

  await c.env.DB.prepare('DELETE FROM tabs WHERE user_id = ?').bind(userId).run()

  const stmts = body.tabs.map((t) =>
    c.env.DB.prepare(
      'INSERT INTO tabs (id, user_id, title, url, favicon_url, position, is_pinned, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(newId(), userId, t.title ?? null, t.url, t.favicon_url ?? null, t.position, t.is_pinned ?? 0, t.is_active ?? 0)
  )
  if (stmts.length > 0) await c.env.DB.batch(stmts)
  return c.json({ ok: true, count: body.tabs.length })
})
