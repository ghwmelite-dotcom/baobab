import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { newId, getUserById } from '../lib/db'
import { runChat, runChatStream, pickModel, type ChatMessage } from '../services/ai'
import type { AppContext } from '../types'

export const ai = new Hono<AppContext>()

ai.use('*', authMiddleware)
ai.use('*', rateLimit({ requests: 30, windowSec: 60, keyPrefix: 'ai' }))

ai.post('/chat', async (c) => {
  const body = await c.req.json<{
    message: string
    model_id?: string
    conversation_id?: string
    page_context?: string
  }>()
  if (!body.message) return c.json({ error: 'message required' }, 400)

  const userId = c.get('userId')!
  const user = await getUserById(c.env.DB, userId)
  const model = pickModel(c.env, { model: body.model_id, lowBw: !!user?.low_bandwidth_mode })

  let convId = body.conversation_id
  if (!convId) {
    convId = newId()
    await c.env.DB.prepare(
      'INSERT INTO conversations (id, user_id, title, model, page_url) VALUES (?, ?, ?, ?, ?)'
    ).bind(convId, userId, body.message.slice(0, 60), model, body.page_context ?? null).run()
  }

  const history = await c.env.DB.prepare(
    'SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(convId).all<{ role: string; content: string }>()
  const past: ChatMessage[] = (history.results ?? []).reverse().map((r) => ({
    role: r.role as ChatMessage['role'],
    content: r.content,
  }))

  const sys: ChatMessage = {
    role: 'system',
    content:
      'You are Baobab AI, an intelligent browsing assistant for an African-first sovereign browser. ' +
      (body.page_context ? `The user is currently viewing: ${body.page_context}` : ''),
  }
  const messages: ChatMessage[] = [sys, ...past, { role: 'user', content: body.message }]

  await c.env.DB.prepare(
    'INSERT INTO chat_messages (id, user_id, conversation_id, role, content, model, page_context) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(newId(), userId, convId, 'user', body.message, model, body.page_context ?? null).run()

  const stream = await runChatStream(c.env, model, messages)

  let collected = ''
  const decoder = new TextDecoder()
  const transform = new TransformStream({
    transform(chunk, controller) {
      collected += decoder.decode(chunk, { stream: true })
      controller.enqueue(chunk)
    },
    async flush() {
      const text = extractTextFromSSE(collected)
      await c.env.DB.prepare(
        'INSERT INTO chat_messages (id, user_id, conversation_id, role, content, model) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(newId(), userId, convId, 'assistant', text, model).run()
    },
  })

  return new Response(stream.pipeThrough(transform), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Conversation-Id': convId,
    },
  })
})

function extractTextFromSSE(raw: string): string {
  let out = ''
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') continue
    try {
      const obj = JSON.parse(data) as { response?: string }
      if (obj.response) out += obj.response
    } catch { /* skip malformed */ }
  }
  return out
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

ai.post('/summarize', async (c) => {
  const body = await c.req.json<{ url?: string; html_content?: string }>()
  if (!body.url) return c.json({ error: 'url required' }, 400)

  const cacheKey = `summary:${await sha256(body.url)}`
  const cached = await c.env.PAGE_CACHE.get(cacheKey)
  if (cached) return c.json({ ...JSON.parse(cached), cached: true })

  let html = body.html_content
  if (!html) {
    const fetched = await fetch(body.url, { headers: { 'User-Agent': 'BaobabBot/1.0 (+https://baobab.africa)' } })
    if (!fetched.ok) return c.json({ error: 'failed to fetch url' }, 502)
    html = (await fetched.text()).slice(0, 6000)
  }

  const user = await getUserById(c.env.DB, c.get('userId')!)
  const model = pickModel(c.env, { model: c.env.SUMMARIZE_MODEL, lowBw: !!user?.low_bandwidth_mode })

  const reply = await runChat(c.env, model, [
    {
      role: 'system',
      content:
        'Summarize the page content into a 3-sentence summary, then list 3-5 key points as a JSON array. Output strict JSON: {"summary":"...","key_points":["..."],"est_read_time":N}',
    },
    { role: 'user', content: html.slice(0, 6000) },
  ])

  let parsed: { summary: string; key_points: string[]; est_read_time: number }
  try {
    parsed = JSON.parse(reply.replace(/^```json\s*|\s*```$/g, ''))
  } catch {
    parsed = { summary: reply.slice(0, 500), key_points: [], est_read_time: 1 }
  }

  await c.env.PAGE_CACHE.put(cacheKey, JSON.stringify(parsed), { expirationTtl: 3600 })
  return c.json({ ...parsed, cached: false })
})
