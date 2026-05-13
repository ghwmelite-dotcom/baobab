import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `exp-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  const access = (await r.json() as { access: string }).access
  await SELF.fetch('http://baobab/api/auth/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ privacy_mode: 0 }),
  })
  return access
}

interface ExportBody {
  version: number
  exportedAt: string
  user: Record<string, unknown>
  bookmark_folders: unknown[]
  bookmarks: Array<{ url: string }>
  history: Array<{ url: string }>
  offline_metadata: unknown[]
}

describe('GET /api/me/export', () => {
  it('returns versioned JSON containing seeded data and no password_hash', async () => {
    const access = await token()
    await SELF.fetch('http://baobab/api/bookmarks', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://export.example/bm', title: 'Bookmark' }),
    })
    await SELF.fetch('http://baobab/api/history', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://export.example/hist', title: 'Page' }),
    })

    const r = await SELF.fetch('http://baobab/api/me/export', {
      headers: { Authorization: `Bearer ${access}` },
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toMatch(/application\/json/)
    expect(r.headers.get('Content-Disposition')).toMatch(/baobab-export-/)
    const text = await r.text()
    // Hard guarantee: the raw serialized bytes must never contain the
    // hash column key, regardless of how the user record is nested.
    expect(text).not.toMatch(/password_hash/)
    const j = JSON.parse(text) as ExportBody
    expect(j.version).toBe(1)
    expect(typeof j.exportedAt).toBe('string')
    expect(j.user).toBeTruthy()
    expect(Object.keys(j.user)).not.toContain('password_hash')
    expect(j.bookmarks.some((b) => b.url === 'https://export.example/bm')).toBe(true)
    expect(j.history.some((h) => h.url === 'https://export.example/hist')).toBe(true)
    expect(Array.isArray(j.offline_metadata)).toBe(true)
  })

  it('returns 401 without auth', async () => {
    const r = await SELF.fetch('http://baobab/api/me/export')
    expect(r.status).toBe(401)
  })
})
