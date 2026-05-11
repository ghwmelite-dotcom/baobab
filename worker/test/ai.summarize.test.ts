import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `s-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('POST /api/ai/summarize', () => {
  it('returns a summary structure', async () => {
    const access = await token()
    const r = await SELF.fetch('http://baobab/api/ai/summarize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', html_content: 'Africa is a continent. Baobab grows here. Many trees.' }),
    })
    expect(r.status).toBe(200)
    const j = await r.json() as { summary: string; cached: boolean }
    expect(typeof j.summary).toBe('string')
    expect(j.cached).toBe(false)
  })
})
