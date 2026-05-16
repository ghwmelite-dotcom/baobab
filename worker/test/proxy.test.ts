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
