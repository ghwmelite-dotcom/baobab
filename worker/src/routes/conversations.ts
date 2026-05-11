import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { newId } from '../lib/db'
import type { AppContext } from '../types'

export const conversations = new Hono<AppContext>()
conversations.use('*', authMiddleware)

conversations.get('/', async (c) => {
  const r = await c.env.DB.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100')
    .bind(c.get('userId')).all()
  return c.json({ items: r.results ?? [] })
})

conversations.get('/:id/messages', async (c) => {
  const r = await c.env.DB.prepare(
    'SELECT * FROM chat_messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC'
  ).bind(c.req.param('id'), c.get('userId')).all()
  return c.json({ items: r.results ?? [] })
})

conversations.post('/', async (c) => {
  const body = await c.req.json<{ title?: string; model?: string; page_url?: string }>()
  const id = newId()
  await c.env.DB.prepare(
    'INSERT INTO conversations (id, user_id, title, model, page_url) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, c.get('userId'), body.title ?? 'New conversation', body.model ?? null, body.page_url ?? null).run()
  return c.json({ id })
})

conversations.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId')).run()
  return c.json({ ok: true })
})
