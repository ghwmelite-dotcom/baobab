import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { newId } from '../lib/db'
import type { AppContext } from '../types'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export const assets = new Hono<AppContext>()
assets.use('*', authMiddleware)

assets.post('/upload', async (c) => {
  const ct = c.req.header('Content-Type') ?? 'application/octet-stream'
  const body = await c.req.arrayBuffer()
  if (body.byteLength > MAX_BYTES) return c.json({ error: 'too large' }, 413)
  const userId = c.get('userId')!
  const key = `u/${userId}/${newId()}`
  await c.env.ASSETS.put(key, body, { httpMetadata: { contentType: ct } })
  return c.json({ key })
})

assets.get('/:key{.+}', async (c) => {
  const key = c.req.param('key')
  if (!key.startsWith(`u/${c.get('userId')}/`)) return c.json({ error: 'forbidden' }, 403)
  const obj = await c.env.ASSETS.get(key)
  if (!obj) return c.json({ error: 'not found' }, 404)
  const ct = obj.httpMetadata?.contentType ?? 'application/octet-stream'
  // Consume the R2 body as an ArrayBuffer rather than streaming the body
  // ReadableStream. Two reasons:
  //   1. The streaming path returns a ReadableStream owned by R2; under
  //      vitest-pool-workers' isolated-storage stack, the test runner
  //      can't pop the storage frame until the stream is fully consumed,
  //      causing "Isolated storage failed" failures (CI test step).
  //   2. The 10 MB upload cap above bounds the buffer; production memory
  //      stays within Workers' 128 MB limit.
  const buf = await obj.arrayBuffer()
  return new Response(buf, { headers: { 'Content-Type': ct } })
})
