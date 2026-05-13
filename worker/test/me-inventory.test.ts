import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `inv-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  const access = (await r.json() as { access: string }).access
  // History writes are gated by privacy_mode, so flip it off for seeding.
  await SELF.fetch('http://baobab/api/auth/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ privacy_mode: 0 }),
  })
  return access
}

interface InventoryBody {
  bookmarks: number
  history: number
  offline_articles: number
  offline_bytes: number
  account_created_at: number
  last_visit_at: number | null
}

describe('GET /api/me/inventory', () => {
  it('returns correct counts after seeding bookmarks and history', async () => {
    const access = await token()
    // Three bookmarks.
    for (const url of ['https://a.example', 'https://b.example', 'https://c.example']) {
      await SELF.fetch('http://baobab/api/bookmarks', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
    }
    // Two history rows (distinct URLs so the dedupe path in /api/history
    // creates two rows rather than incrementing a single visit_count).
    for (const url of ['https://h1.example', 'https://h2.example']) {
      await SELF.fetch('http://baobab/api/history', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title: 'page' }),
      })
    }

    const r = await SELF.fetch('http://baobab/api/me/inventory', {
      headers: { Authorization: `Bearer ${access}` },
    })
    expect(r.status).toBe(200)
    const j = (await r.json()) as InventoryBody
    expect(j.bookmarks).toBe(3)
    expect(j.history).toBe(2)
    expect(j.offline_articles).toBe(0)
    expect(j.offline_bytes).toBe(0)
    expect(j.account_created_at).toBeGreaterThan(0)
    expect(j.last_visit_at).not.toBeNull()
  })

  it('returns 401 without auth', async () => {
    const r = await SELF.fetch('http://baobab/api/me/inventory')
    expect(r.status).toBe(401)
  })
})
