import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `o-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('offline articles', () => {
  it('save then list', async () => {
    const access = await token()
    const save = await SELF.fetch('http://baobab/api/offline/save', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/article',
        title: 'Test article',
        cleaned_html: '<p>Hello</p>',
        ai_summary: 'A test',
        word_count: 1,
        est_read_minutes: 1,
      }),
    })
    expect(save.status).toBe(200)
    const list = await SELF.fetch('http://baobab/api/offline', { headers: { Authorization: `Bearer ${access}` } })
    const j = await list.json() as { items: Array<{ url: string }> }
    expect(j.items.some((a) => a.url === 'https://example.com/article')).toBe(true)
  })
})
