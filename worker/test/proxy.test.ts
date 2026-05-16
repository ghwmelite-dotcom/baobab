import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `pr-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('POST /api/proxy/fetch', () => {
  it('is public — succeeds without an Authorization header', async () => {
    const r = await SELF.fetch('http://baobab/api/proxy/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        html_content: '<html><head><title>Example</title></head><body><article><p>Hello Baobab.</p></article></body></html>',
        skip_ai: true,
      }),
    })
    expect(r.status).toBe(200)
    const j = await r.json() as { title: string; ads_blocked: number; word_count: number }
    expect(typeof j.title).toBe('string')
    expect(typeof j.ads_blocked).toBe('number')
    expect(typeof j.word_count).toBe('number')
  })

  it('also works with auth (back-compat for the existing reader panel)', async () => {
    const access = await token()
    const r = await SELF.fetch('http://baobab/api/proxy/fetch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        html_content: '<html><head><title>Example</title></head><body><article><p>Hello Baobab.</p></article></body></html>',
        skip_ai: true,
      }),
    })
    expect(r.status).toBe(200)
  })

  it('returns 400 when url is missing', async () => {
    const r = await SELF.fetch('http://baobab/api/proxy/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html_content: '<html></html>' }),
    })
    expect(r.status).toBe(400)
  })
})

describe('POST /api/proxy/fetch bytes-saved surfacing', () => {
  it('returns bytes_saved using the domain-tier multiplier', async () => {
    // Fixture: ~1000-byte raw HTML for an nytimes URL → factor 8
    const html = '<html><body>' + 'x'.repeat(900) + '<article>title</article></body></html>'
    const r = await SELF.fetch('http://baobab/api/proxy/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.nytimes.com/article/abc',
        html_content: html,
        skip_ai: true,
      }),
    })
    expect(r.status).toBe(200)
    const json = await r.json() as {
      bytes_saved: number
      bytes_saved_adblock: number
      cleaned_html: string
    }
    // factor=8, raw.length ≈ html.length (~950). Response includes cleaned_html
    // so it's smaller than (raw × 8). Sanity check: bytes_saved is positive and
    // much larger than the html.length - cleaned_html.length diff alone.
    expect(json.bytes_saved).toBeGreaterThan(html.length * 6)
    expect(json.bytes_saved_adblock).toBeGreaterThanOrEqual(0)
  })

  it('returns bytes_saved >= 0 for default-factor domains', async () => {
    const html = '<html><body><article>' + 'y'.repeat(500) + '</article></body></html>'
    const r = await SELF.fetch('http://baobab/api/proxy/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/page',
        html_content: html,
        skip_ai: true,
      }),
    })
    expect(r.status).toBe(200)
    const json = await r.json() as { bytes_saved: number }
    // factor=4, raw≈530 bytes → ~2120 estimate. Response is ~600 bytes. saved ≈ 1500.
    expect(json.bytes_saved).toBeGreaterThan(0)
  })

  it('bytes_saved is clamped to >= 0 even when response > estimate', async () => {
    // Worst case: tiny raw, huge cleaned (would never happen in practice, but
    // verify the Math.max(0, ...) clamp).
    const html = '<html><body><article>x</article></body></html>'
    const r = await SELF.fetch('http://baobab/api/proxy/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/x', html_content: html, skip_ai: true }),
    })
    const json = await r.json() as { bytes_saved: number; bytes_saved_adblock: number }
    expect(json.bytes_saved).toBeGreaterThanOrEqual(0)
    expect(json.bytes_saved_adblock).toBeGreaterThanOrEqual(0)
  })
})
