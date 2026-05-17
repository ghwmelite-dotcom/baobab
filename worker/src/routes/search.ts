import { Hono } from 'hono'
import type { AppContext } from '../types'
import { searchGoogle } from '../services/pse'
import { rerank } from '../services/africaRank'
import { detectIntent, extractSiteCard } from '../services/intent'
import { synthesize, type ContextChainEntry, type SourceContext } from '../services/answerSynthesis'
import { cacheKey, cacheGet, cacheSet } from '../services/searchCache'
import { consume } from '../services/searchQuota'

interface SearchRequest {
  query: string
  context?: ContextChainEntry[]
  targetLanguage?: 'yo' | 'sw' | 'ha' | 'ig' | 'am' | 'zu' | 'xh' | 'wo' | 'ak'
  source?: SourceContext
}

export const search = new Hono<AppContext>()

search.post('/', async (c) => {
  const body = await c.req.json<SearchRequest>().catch(() => null)
  if (!body || typeof body.query !== 'string' || body.query.trim().length === 0) {
    return c.json({ error: 'query_required' }, 400)
  }
  const truncated = body.query.length > 2000 ? body.query.slice(0, 2000) : body.query
  const query = truncated.trim()
  const contextChain = (body.context ?? []).slice(-5)
  const targetLanguage = body.targetLanguage ?? null

  // 1. Cache lookup
  const key = await cacheKey(query, targetLanguage, contextChain)
  const cached = await cacheGet<Record<string, unknown>>(c.env.KV, key)
  if (cached) {
    const meta = (cached.meta as Record<string, unknown>) ?? {}
    return c.json({ ...cached, meta: { ...meta, cached: true } })
  }

  // 2. Quota check
  const quota = await consume(c.env.KV)

  // 3. PSE call (skip if hard-cap hit)
  let pseResults = [] as Awaited<ReturnType<typeof searchGoogle>>
  if (quota.allowed) {
    try {
      pseResults = await searchGoogle(
        { GOOGLE_PSE_API_KEY: c.env.GOOGLE_PSE_API_KEY, GOOGLE_PSE_CX: c.env.GOOGLE_PSE_CX },
        query, 10,
      )
    } catch {
      pseResults = []
    }
  }

  // 4. Re-rank
  const ranked = rerank(pseResults.map((p) => ({
    title: p.title, url: p.link, snippet: p.snippet, source: p.displayLink,
  })))

  // 5. Intent
  const intent = detectIntent(query, pseResults[0] ?? null)
  const siteCard = intent === 'navigational' && pseResults[0]
    ? extractSiteCard(pseResults[0])
    : undefined

  // 6. AI answer + citations
  const synth = await synthesize(c.env.AI as never, query, ranked, contextChain, body.source)

  // 7. Bilingual translation
  let bilingual: { lang: string; text: string } | undefined
  let translateFailed = false
  if (targetLanguage && synth.answer) {
    try {
      const t = await translateText(c.env.AI as never, synth.answer, targetLanguage)
      if (t) bilingual = { lang: targetLanguage, text: t }
      else translateFailed = true
    } catch {
      translateFailed = true
    }
  }

  // 8. Diversity meter
  const countries = new Set(ranked.map((r) => r.country).filter((x): x is string => Boolean(x)))
  const africanCount = ranked.filter((r) => r.isAfrican).length
  const africanVoicePercent = ranked.length === 0 ? 0
    : Math.round((africanCount / ranked.length) * 100)

  // 9. Build response
  const response = {
    intent,
    query,
    answer: synth.answer ? { en: synth.answer, ...(bilingual ? { bilingual } : {}) } : null,
    citations: synth.citations,
    results: ranked,
    diversity: {
      sourceCount: ranked.length,
      countryCount: countries.size,
      africanVoicePercent,
    },
    ...(siteCard ? { siteCard } : {}),
    meta: {
      cached: false,
      pseQueriesRemainingToday: quota.remaining,
      ...(quota.fallbackMode ? { fallbackMode: quota.fallbackMode } : {}),
      ...(translateFailed ? { translateFailed: true } : {}),
    },
  }

  // 10. Cache (24h)
  await cacheSet(c.env.KV, key, response, 86400)

  return c.json(response)
})

async function translateText(
  ai: { run(m: string, i: { prompt: string }): Promise<{ response?: string }> },
  text: string,
  targetLang: string,
): Promise<string | null> {
  const langName = ({
    yo: 'Yoruba', sw: 'Swahili', ha: 'Hausa', ig: 'Igbo', am: 'Amharic',
    zu: 'Zulu', xh: 'Xhosa', wo: 'Wolof', ak: 'Akan',
  } as Record<string, string>)[targetLang]
  if (!langName) return null
  const out = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
    prompt: `Translate the following English text into ${langName}. Reply with the translation only, no preamble.\n\nText: ${text}`,
  })
  const t = (out.response ?? '').trim()
  return t.length > 0 ? t : null
}
