import { Hono } from 'hono'
import { rateLimit } from '../middleware/rate-limit'
import { stripAds } from '../services/adblock'
import { extractReadable, summarizeAndExtract } from '../services/reader'
import { newId, getUserById } from '../lib/db'
import { pickModel } from '../services/ai'
import type { AppContext } from '../types'

export const proxy = new Hono<AppContext>()

// /api/proxy/fetch is intentionally public for Bundle B. reader.html runs in a
// fresh JS context that doesn't carry the parent profile's auth.store; gating
// it on auth would defeat the bundle thesis. Mirrors /api/ai/search.
// rate-limit middleware naturally keys on CF-Connecting-IP when userId is null
// (see middleware/rate-limit.ts:24–26).
proxy.use('*', rateLimit({ requests: 30, windowSec: 60, keyPrefix: 'proxy' }))

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

proxy.post('/fetch', async (c) => {
  const body = await c.req.json<{ url?: string; html_content?: string; skip_ai?: boolean }>()
  if (!body.url) return c.json({ error: 'url required' }, 400)

  let parsed: URL
  try { parsed = new URL(body.url) } catch { return c.json({ error: 'invalid url' }, 400) }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return c.json({ error: 'unsupported protocol' }, 400)
  }

  const cacheKey = `reader:${await sha256(body.url)}`
  const cached = await c.env.PAGE_CACHE.get(cacheKey)
  if (cached) return c.json({ ...JSON.parse(cached), cached: true })

  // html_content lets clients (and tests) supply page HTML inline so the
  // worker doesn't have to perform an outbound fetch — mirrors the pattern
  // used by /api/ai/summarize. When omitted we fetch the URL ourselves.
  let raw: string
  if (body.html_content) {
    raw = body.html_content
  } else {
    const fetched = await fetch(body.url, {
      headers: {
        'User-Agent': 'BaobabBot/1.0 (+https://baobab.africa)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })
    if (!fetched.ok) return c.json({ error: `upstream ${fetched.status}` }, 502)
    raw = await fetched.text()
  }

  const { html, ads_blocked, trackers_blocked } = stripAds(raw)
  const page = extractReadable(html)

  const uid = c.get('userId')
  if (uid) {
    await c.env.DB.prepare(
      'INSERT INTO adblock_stats (id, user_id, url, ads_blocked, trackers_blocked, bytes_saved) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(newId(), uid, body.url, ads_blocked, trackers_blocked, raw.length - html.length).run()
  }

  let ai_summary = ''
  let key_points: string[] = []
  if (!body.skip_ai && page.word_count > 50) {
    const user = uid ? await getUserById(c.env.DB, uid) : null
    const model = pickModel(c.env, { lowBw: !!user?.low_bandwidth_mode, model: c.env.SUMMARIZE_MODEL })
    const x = await summarizeAndExtract(c.env, model, page)
    ai_summary = x.summary
    key_points = x.key_points
  }

  const result = {
    title: page.title,
    cleaned_html: page.cleaned_html,
    text: page.text,
    word_count: page.word_count,
    est_read_minutes: page.est_read_minutes,
    ads_blocked,
    trackers_blocked,
    ai_summary,
    key_points,
    cached: false,
  }

  await c.env.PAGE_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 1800 })
  return c.json(result)
})
