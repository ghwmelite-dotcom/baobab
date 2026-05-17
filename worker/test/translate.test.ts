import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

// The AI binding is stubbed at the miniflare layer (see vitest.config.ts).
// For translation requests with `target_lang === 'yo'` the stub returns
// `{ translated_text: 'Ẹ káàárọ̀.' }`; passing the sentinel `target_lang: 'fail'`
// makes the stub throw, which exercises the llama fallback path in the route.

describe('POST /api/translate', () => {
  it('returns m2m100 translation for a Yoruba target', async () => {
    const r = await SELF.fetch('http://baobab/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Good morning.', targetLang: 'yo' }),
    })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { translatedText: string; model: string; detectedSourceLang: string }
    // Yoruba 'Ẹ káàárọ̀.' — diacritics expressed as escapes so the literal
    // is invariant under any encoding hop between the editor, git, and node.
    expect(j.translatedText).toBe('Ẹ káàárọ̀.')
    expect(j.model).toBe('m2m100')
    expect(j.detectedSourceLang).toBe('en')
  })

  it('falls back to llama when m2m100 throws', async () => {
    const r = await SELF.fetch('http://baobab/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Good morning.', targetLang: 'fail' }),
    })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { translatedText: string; model: string }
    expect(j.model).toBe('llama')
    // The default chat stub returns `{ response: 'ok' }`.
    expect(j.translatedText).toBe('ok')
  })

  it('passes through an explicit sourceLang', async () => {
    const r = await SELF.fetch('http://baobab/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello world.', sourceLang: 'en', targetLang: 'sw' }),
    })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { translatedText: string; detectedSourceLang: string }
    expect(j.detectedSourceLang).toBe('en')
    expect(j.translatedText).toContain('[sw]')
  })

  it('returns 400 when text is missing', async () => {
    const r = await SELF.fetch('http://baobab/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetLang: 'yo' }),
    })
    expect(r.status).toBe(400)
  })

  it('returns 400 when targetLang is missing', async () => {
    const r = await SELF.fetch('http://baobab/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Good morning.' }),
    })
    expect(r.status).toBe(400)
  })
})
