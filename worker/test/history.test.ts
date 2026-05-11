import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `h-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  const access = (await r.json() as { access: string }).access
  // Disable privacy_mode so history writes are not skipped.
  await SELF.fetch('http://baobab/api/auth/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ privacy_mode: 0 }),
  })
  return access
}

describe('history', () => {
  it('add then list', async () => {
    const access = await token()
    await SELF.fetch('http://baobab/api/history', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', title: 'Example' }),
    })
    const r = await SELF.fetch('http://baobab/api/history', { headers: { Authorization: `Bearer ${access}` } })
    const j = await r.json() as { items: Array<{ url: string; title: string }> }
    expect(j.items.some((i) => i.url === 'https://example.com')).toBe(true)
  })
  it('clear all', async () => {
    const access = await token()
    await SELF.fetch('http://baobab/api/history', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://x.com', title: 'X' }),
    })
    await SELF.fetch('http://baobab/api/history', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${access}` },
    })
    const r = await SELF.fetch('http://baobab/api/history', { headers: { Authorization: `Bearer ${access}` } })
    const j = await r.json() as { items: unknown[] }
    expect(j.items).toHaveLength(0)
  })
})
