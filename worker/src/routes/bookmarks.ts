import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { newId } from '../lib/db'
import type { AppContext } from '../types'

export const bookmarks = new Hono<AppContext>()
bookmarks.use('*', authMiddleware)

bookmarks.get('/', async (c) => {
  const userId = c.get('userId')!
  const [folders, bms] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM bookmark_folders WHERE user_id = ? ORDER BY position').bind(userId).all(),
    c.env.DB.prepare('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY position').bind(userId).all(),
  ])
  return c.json({ folders: folders.results ?? [], bookmarks: bms.results ?? [] })
})

bookmarks.post('/', async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json<{ url: string; title?: string; description?: string; folder_id?: string; favicon_url?: string; position?: number }>()
  if (!body.url) return c.json({ error: 'url required' }, 400)
  const id = newId()
  await c.env.DB.prepare(
    'INSERT INTO bookmarks (id, user_id, url, title, description, folder_id, favicon_url, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, body.url, body.title ?? null, body.description ?? null, body.folder_id ?? null, body.favicon_url ?? null, body.position ?? 0).run()
  return c.json({ ok: true, id })
})

bookmarks.put('/:id', async (c) => {
  const userId = c.get('userId')!
  const id = c.req.param('id')
  const body = await c.req.json<Record<string, unknown>>()
  const allowed = ['url', 'title', 'description', 'folder_id', 'favicon_url', 'position'] as const
  const sets: string[] = []
  const vals: unknown[] = []
  for (const f of allowed) {
    if (f in body) { sets.push(`${f} = ?`); vals.push(body[f]) }
  }
  if (sets.length === 0) return c.json({ error: 'no fields' }, 400)
  vals.push(id, userId)
  await c.env.DB.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).bind(...vals).run()
  return c.json({ ok: true })
})

bookmarks.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('userId')).run()
  return c.json({ ok: true })
})

bookmarks.post('/folders', async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json<{ name: string; parent_id?: string; position?: number }>()
  if (!body.name) return c.json({ error: 'name required' }, 400)
  const id = newId()
  await c.env.DB.prepare(
    'INSERT INTO bookmark_folders (id, user_id, name, parent_id, position) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, body.name, body.parent_id ?? null, body.position ?? 0).run()
  return c.json({ ok: true, id })
})
