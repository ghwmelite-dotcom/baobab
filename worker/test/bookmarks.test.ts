import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `b-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('bookmarks', () => {
  it('create folder + bookmark, list returns both', async () => {
    const access = await token()
    const f = await SELF.fetch('http://baobab/api/bookmarks/folders', {
      method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Africa' }),
    })
    const folder = await f.json() as { id: string }
    await SELF.fetch('http://baobab/api/bookmarks', {
      method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://au.int', title: 'African Union', folder_id: folder.id }),
    })
    const r = await SELF.fetch('http://baobab/api/bookmarks', { headers: { Authorization: `Bearer ${access}` } })
    const j = await r.json() as { folders: unknown[]; bookmarks: Array<{ url: string }> }
    expect(j.folders.length).toBeGreaterThanOrEqual(1)
    expect(j.bookmarks.some((b) => b.url === 'https://au.int')).toBe(true)
  })
})
