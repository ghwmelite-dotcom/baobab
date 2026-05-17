import type { Env } from '../types'
import { runChat } from './ai'

export interface DigestSource {
  id: string
  name: string
  country: string
  rssUrl: string
}

export interface DigestItem {
  id: string
  title: string
  summary: string
  source: { id: string; name: string; country: string }
  url: string
  publishedAt: string
}

interface RawItem {
  source: DigestSource
  title: string
  link: string
  description: string
  publishedAt: string
}

// Curated African outlets. Chosen for editorial independence, broad geographic
// spread (Nigeria, South Africa, Kenya), and reliable public RSS feeds. The
// list is intentionally small to keep the per-day Workers AI cost predictable.
export const SOURCES: DigestSource[] = [
  { id: 'punch',          name: 'Punch',          country: 'NG', rssUrl: 'https://punchng.com/feed/' },
  { id: 'daily-maverick', name: 'Daily Maverick', country: 'ZA', rssUrl: 'https://www.dailymaverick.co.za/dmrss/' },
  { id: 'premium-times',  name: 'Premium Times',  country: 'NG', rssUrl: 'https://www.premiumtimesng.com/feed' },
  { id: 'daily-nation',   name: 'Daily Nation',   country: 'KE', rssUrl: 'https://nation.africa/kenya/rss' },
  { id: 'mail-guardian',  name: 'Mail & Guardian', country: 'ZA', rssUrl: 'https://mg.co.za/feed/' },
  { id: 'techcabal',      name: 'TechCabal',      country: 'NG', rssUrl: 'https://techcabal.com/feed/' },
]

const ITEMS_PER_SOURCE = 2
const FINAL_ITEM_LIMIT = 10
const CACHE_TTL_SECONDS = 12 * 60 * 60 // 12h

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function cacheKey(): string {
  return `digest:${todayUtc()}`
}

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTag(block: string, tag: string): string {
  // Match either `<tag>...</tag>` or `<tag ...attr...>...</tag>`. Tolerant of
  // namespaced tags (e.g. <dc:creator>) — we only call it with simple names.
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = re.exec(block)
  return m ? stripTags(m[1] ?? '') : ''
}

function extractLink(block: string): string {
  // RSS uses <link>...</link>; Atom uses <link href="..." />. Handle both.
  const atom = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block)
  if (atom) return atom[1] ?? ''
  return extractTag(block, 'link')
}

function parseRssItems(xml: string, source: DigestSource): RawItem[] {
  const out: RawItem[] = []
  // Iterate over <item> ... </item> (RSS) and <entry> ... </entry> (Atom).
  const blockRe = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(xml)) !== null) {
    const block = m[2] ?? ''
    const title = extractTag(block, 'title')
    const link = extractLink(block)
    const description =
      extractTag(block, 'description') ||
      extractTag(block, 'summary') ||
      extractTag(block, 'content')
    const pubRaw =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      extractTag(block, 'dc:date')
    if (!title || !link) continue
    const publishedAt = pubRaw ? new Date(pubRaw).toISOString() : new Date().toISOString()
    out.push({ source, title, link, description, publishedAt })
    if (out.length >= ITEMS_PER_SOURCE * 4) break // hard cap on parse work
  }
  // Newest first by publishedAt; take top N per source.
  out.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
  return out.slice(0, ITEMS_PER_SOURCE)
}

async function fetchSource(source: DigestSource): Promise<RawItem[]> {
  const res = await fetch(source.rssUrl, {
    headers: {
      'User-Agent': 'BaobabBot/1.0 (+https://baobab.africa) DigestFetcher',
      Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8',
    },
  })
  if (!res.ok) return []
  const xml = await res.text()
  return parseRssItems(xml, source)
}

async function summarize(env: Env, raw: RawItem): Promise<string> {
  const prompt = raw.description ? `${raw.title}\n\n${raw.description}` : raw.title
  try {
    const reply = await runChat(env, '@cf/meta/llama-3.1-8b-instruct', [
      {
        role: 'system',
        content:
          'Summarize this news item in 80 words or fewer. Plain prose. No bullet points, no headings, no preamble. Return only the summary text.',
      },
      { role: 'user', content: prompt },
    ])
    const cleaned = reply.trim()
    return cleaned.length > 0 ? cleaned : raw.title
  } catch {
    // Falls back to the headline if the model errors out — better than dropping
    // the item entirely.
    return raw.title
  }
}

function itemId(raw: RawItem): string {
  // Deterministic per (source, link). Used as React key on the client.
  return `${raw.source.id}:${hash(raw.link)}`
}

function hash(s: string): string {
  // Tiny non-cryptographic hash (djb2). Enough to keep the id stable and short.
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export async function assembleDigest(env: Env): Promise<DigestItem[]> {
  const key = cacheKey()
  const cached = await env.PAGE_CACHE.get(key)
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as DigestItem[]
      if (Array.isArray(parsed)) return parsed
    } catch {
      // fall through, regenerate
    }
  }

  // Fetch all feeds in parallel; tolerate per-source failure.
  const settled = await Promise.allSettled(SOURCES.map((s) => fetchSource(s)))
  const raws: RawItem[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') raws.push(...r.value)
  }

  // Sort by publishedAt desc and cap at FINAL_ITEM_LIMIT before summarizing
  // (so we don't pay AI cost for items we'll throw away).
  raws.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
  const picked = raws.slice(0, FINAL_ITEM_LIMIT)

  const summaries = await Promise.allSettled(picked.map((r) => summarize(env, r)))
  const items: DigestItem[] = picked.map((raw, i) => {
    const s = summaries[i]
    const summary = s && s.status === 'fulfilled' ? s.value : raw.title
    return {
      id: itemId(raw),
      title: raw.title,
      summary,
      source: { id: raw.source.id, name: raw.source.name, country: raw.source.country },
      url: raw.link,
      publishedAt: raw.publishedAt,
    }
  })

  // Cache for 12h. Failure to write is non-fatal — the next request will retry.
  try {
    await env.PAGE_CACHE.put(key, JSON.stringify(items), { expirationTtl: CACHE_TTL_SECONDS })
  } catch {
    // tolerate
  }

  return items
}
