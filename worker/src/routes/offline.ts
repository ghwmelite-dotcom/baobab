import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { newId } from '../lib/db'
import type { AppContext } from '../types'

export const offline = new Hono<AppContext>()
offline.use('*', authMiddleware)

function getDoForUser(env: AppContext['Bindings'], userId: string) {
  const id = env.READER_QUEUE.idFromName(`user:${userId}`)
  return env.READER_QUEUE.get(id)
}

offline.post('/save', async (c) => {
  const userId = c.get('userId')!
  const body = await c.req.json<{
    url: string
    title?: string
    cleaned_html: string
    ai_summary?: string
    word_count: number
    est_read_minutes: number
  }>()
  if (!body.url || !body.cleaned_html) return c.json({ error: 'url and cleaned_html required' }, 400)

  const id = newId()
  const r2_key = `offline/${userId}/${id}`
  const bytes = new TextEncoder().encode(body.cleaned_html)
  await c.env.OFFLINE.put(r2_key, bytes, { httpMetadata: { contentType: 'text/html; charset=utf-8' } })

  const stub = getDoForUser(c.env, userId)
  const saveRes = await stub.fetch('https://do/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      user_id: userId,
      url: body.url,
      title: body.title ?? null,
      r2_key,
      ai_summary: body.ai_summary ?? null,
      word_count: body.word_count,
      est_read_minutes: body.est_read_minutes,
      size_bytes: bytes.length,
    }),
  })
  // Drain the response body so the RPC reference is released.
  await saveRes.text()

  await c.env.DB.prepare(
    'INSERT INTO offline_articles (id, user_id, url, title, r2_key, ai_summary, word_count, est_read_minutes, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, body.url, body.title ?? null, r2_key, body.ai_summary ?? null, body.word_count, body.est_read_minutes, bytes.length).run()

  return c.json({ ok: true, id, r2_key })
})

offline.get('/', async (c) => {
  const userId = c.get('userId')!
  const unread = c.req.query('unread') === '1'
  const stub = getDoForUser(c.env, userId)
  const r = await stub.fetch(`https://do/list?user_id=${userId}${unread ? '&unread=1' : ''}`)
  // Consume the body fully here so the underlying RPC reference is released
  // before the request handler returns. Streaming `r.body` directly causes
  // isolated-storage cleanup to fail in vitest-pool-workers on Windows.
  const text = await r.text()
  return new Response(text, { headers: { 'Content-Type': 'application/json' } })
})

offline.get('/:id', async (c) => {
  const userId = c.get('userId')!
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    'SELECT * FROM offline_articles WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first<{ r2_key: string; title: string | null; ai_summary: string | null }>()
  if (!row) return c.json({ error: 'not found' }, 404)
  const obj = await c.env.OFFLINE.get(row.r2_key)
  if (!obj) return c.json({ error: 'asset missing' }, 404)
  const html = await obj.text()
  return c.json({ ...row, cleaned_html: html })
})

offline.post('/:id/read', async (c) => {
  const userId = c.get('userId')!
  const id = c.req.param('id')
  const stub = getDoForUser(c.env, userId)
  const r = await stub.fetch('https://do/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, user_id: userId }),
  })
  await r.text()
  await c.env.DB.prepare('UPDATE offline_articles SET read_at = unixepoch() WHERE id = ? AND user_id = ?')
    .bind(id, userId).run()
  return c.json({ ok: true })
})

offline.delete('/:id', async (c) => {
  const userId = c.get('userId')!
  const id = c.req.param('id')
  const stub = getDoForUser(c.env, userId)
  const r = await stub.fetch(`https://do/?id=${id}&user_id=${userId}`, { method: 'DELETE' })
  await r.text()
  await c.env.DB.prepare('DELETE FROM offline_articles WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ ok: true })
})
