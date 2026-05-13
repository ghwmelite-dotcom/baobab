import { Hono } from 'hono'
import type { AppContext } from '../types'

export const translate = new Hono<AppContext>()

// Translation is intentionally unauthenticated: it should be available to anyone
// who picks up the browser, including users browsing without an account. The
// route is cheap (text-only) and rate-limited at the edge via Cloudflare's
// global request limits; no per-user storage is touched.
translate.post('/', async (c) => {
  const body = await c.req.json<{
    text?: string
    sourceLang?: string
    targetLang?: string
  }>()

  const text = body.text?.trim()
  const targetLang = body.targetLang?.trim()
  if (!text || !targetLang) {
    return c.json({ error: 'text and targetLang required' }, 400)
  }

  const sourceLang = body.sourceLang?.trim() || 'en'

  // Try the dedicated translation model first. It's small, fast, and produces
  // higher-quality output for African languages than a general chat LLM.
  try {
    const out = await c.env.AI.run(
      '@cf/meta/m2m100-1.2b' as never,
      {
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
      } as never,
    )
    const translated = (out as { translated_text?: string }).translated_text ?? ''
    if (translated) {
      return c.json({
        translatedText: translated,
        detectedSourceLang: sourceLang,
        model: 'm2m100',
      })
    }
    // Fall through to the llama fallback when m2m100 returns an empty string.
    throw new Error('m2m100 returned empty translation')
  } catch {
    // Fallback: ask llama-3.1-8b to translate. Cheaper to keep available than a
    // second translation-specific model, and good enough for the long tail.
    const sys = `You are a translator. Translate the user's text to ${targetLang}. Reply with ONLY the translation, no preamble, no explanation.`
    const out = await c.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct' as never,
      {
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: text },
        ],
      } as never,
    )
    return c.json({
      translatedText: (out as { response?: string }).response ?? '',
      detectedSourceLang: body.sourceLang?.trim() || 'auto',
      model: 'llama',
    })
  }
})

export default translate
