import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { newId, getUserById } from '../lib/db'
import { runChat, runChatStream, pickModel, extractJson, type ChatMessage } from '../services/ai'
import { search as searchV2 } from './search'
import type { AppContext } from '../types'

export const ai = new Hono<AppContext>()

// Rate-limit applies to all AI routes. Auth is applied per-route so /search
// can stay public per spec (Anyone can search — no sign-in required).
ai.use('*', rateLimit({ requests: 30, windowSec: 60, keyPrefix: 'ai' }))

ai.post('/chat', authMiddleware, async (c) => {
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

// Strip script/style blocks + tags, collapse whitespace, drop noise like
// long URLs and base64 payloads. Keeps the model focused on real prose.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

ai.post('/summarize', authMiddleware, async (c) => {
  const body = await c.req.json<{ url?: string; html_content?: string }>()
  if (!body.url) return c.json({ error: 'url required' }, 400)

  const cacheKey = `summary:${await sha256(body.url)}`
  const cached = await c.env.PAGE_CACHE.get(cacheKey)
  if (cached) return c.json({ ...JSON.parse(cached), cached: true })

  let rawHtml = body.html_content
  if (!rawHtml) {
    try {
      const fetched = await fetch(body.url, {
        headers: { 'User-Agent': 'BaobabBot/1.0 (+https://baobab.askozzy.work)' },
      })
      if (!fetched.ok) {
        return c.json({ error: 'failed_to_fetch_url', status: fetched.status }, 502)
      }
      rawHtml = await fetched.text()
    } catch (e) {
      return c.json({ error: 'fetch_threw', detail: e instanceof Error ? e.message : 'unknown' }, 502)
    }
  }

  // Strip markup so the model isn't trying to make sense of <script> blobs.
  // 4000 chars of plain prose is plenty for a 3-sentence summary; the
  // smaller window also keeps us well under any model context budget.
  const text = htmlToText(rawHtml).slice(0, 4000)
  if (text.length < 40) {
    return c.json({ error: 'page_has_no_text', length: text.length }, 422)
  }

  const user = await getUserById(c.env.DB, c.get('userId')!)
  const model = pickModel(c.env, { model: c.env.SUMMARIZE_MODEL, lowBw: !!user?.low_bandwidth_mode })

  const summarizePrompt =
    'You are a summarizer. Reply with a JSON object and NOTHING ELSE. No preamble. No code fence.\n' +
    'Schema: {"summary":"3-sentence summary","key_points":["point","point","point"],"est_read_time":N}\n' +
    'est_read_time is the read time in minutes (integer).\n\n' +
    'Example OUTPUT: {"summary":"The page describes X, Y, and Z.","key_points":["X is...","Y is...","Z is..."],"est_read_time":3}'

  let raw: string
  try {
    raw = await runChat(c.env, model, [
      { role: 'system', content: summarizePrompt },
      { role: 'user', content: text },
    ])
  } catch (e) {
    return c.json(
      { error: 'ai_call_failed', model, detail: e instanceof Error ? e.message : 'unknown' },
      502,
    )
  }
  const extracted = extractJson<{ summary: string; key_points: string[]; est_read_time: number }>(raw)

  const parsed = extracted ?? { summary: text.slice(0, 320), key_points: [], est_read_time: 1 }
  if (!Array.isArray(parsed.key_points)) parsed.key_points = []

  await c.env.PAGE_CACHE.put(cacheKey, JSON.stringify(parsed), { expirationTtl: 3600 })
  return c.json({ ...parsed, cached: false })
})

// Forward to the v2 /api/search orchestrator and downcast to v1 shape for
// backward compatibility. Clients that depended on { answer, results: [{title, url}] }
// continue to work unchanged; the richer v2 response is available at /api/search.
ai.post('/search', async (c) => {
  const v2 = await searchV2.fetch(
    new Request(new URL('/', c.req.url).toString(), {
      method: 'POST',
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    }),
    c.env,
    c.executionCtx,
  )
  if (!v2.ok) return v2
  const v2body = await v2.json() as {
    answer: { en: string } | null
    results: Array<{ title: string; url: string }>
  }
  return c.json({
    answer: v2body.answer?.en ?? '',
    results: (v2body.results ?? []).map((r) => ({ title: r.title, url: r.url })),
  })
})

ai.post('/compare', authMiddleware, async (c) => {
  const body = await c.req.json<{ items?: string[]; criteria?: string }>()
  if (!body.items || body.items.length < 2) return c.json({ error: 'need at least 2 items' }, 400)
  const reply = await runChat(c.env, c.env.DEFAULT_MODEL, [
    {
      role: 'system',
      content: 'Compare the items the user provides on the criteria they specify. Output a structured markdown table.',
    },
    { role: 'user', content: `Items: ${body.items.join(' vs ')}\nCriteria: ${body.criteria ?? 'general suitability'}` },
  ])
  return c.json({ comparison: reply })
})
