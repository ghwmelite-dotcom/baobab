import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { newId, getUserById } from '../lib/db'
import type { AppContext } from '../types'

export const history = new Hono<AppContext>()
history.use('*', authMiddleware)

history.get('/', async (c) => {
  const userId = c.get('userId')!
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 200)
  const offset = Number(c.req.query('offset') ?? 0)
  const q = c.req.query('q')
  let stmt
  if (q) {
    stmt = c.env.DB.prepare(
      'SELECT * FROM history WHERE user_id = ? AND (url LIKE ? OR title LIKE ?) ORDER BY last_visited_at DESC LIMIT ? OFFSET ?'
    ).bind(userId, `%${q}%`, `%${q}%`, limit, offset)
  } else {
    stmt = c.env.DB.prepare(
      'SELECT * FROM history WHERE user_id = ? ORDER BY last_visited_at DESC LIMIT ? OFFSET ?'
    ).bind(userId, limit, offset)
  }
  const r = await stmt.all()
  return c.json({ items: r.results ?? [] })
})

history.post('/', async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json<{ url: string; title?: string }>()
  if (!body.url) return c.json({ error: 'url required' }, 400)

  const user = await getUserById(c.env.DB, userId)
  if (user?.privacy_mode) return c.json({ ok: true, skipped: true })

  const existing = await c.env.DB.prepare('SELECT id FROM history WHERE user_id = ? AND url = ?')
    .bind(userId, body.url).first<{ id: string }>()
  if (existing) {
    await c.env.DB.prepare(
      'UPDATE history SET visit_count = visit_count + 1, last_visited_at = unixepoch(), title = COALESCE(?, title) WHERE id = ?'
    ).bind(body.title ?? null, existing.id).run()
    return c.json({ ok: true, id: existing.id })
  }
  const id = newId()
  await c.env.DB.prepare(
    'INSERT INTO history (id, user_id, url, title) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, body.url, body.title ?? null).run()
  return c.json({ ok: true, id })
})

history.delete('/', async (c) => {
  await c.env.DB.prepare('DELETE FROM history WHERE user_id = ?').bind(c.get('userId')).run()
  return c.json({ ok: true })
})

history.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM history WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId')).run()
  return c.json({ ok: true })
})
