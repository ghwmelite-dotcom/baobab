import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `t-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('tabs', () => {
  it('sync replaces user tabs', async () => {
    const access = await token()
    await SELF.fetch('http://baobab/api/tabs/sync', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabs: [
          { url: 'https://a.com', title: 'A', position: 0, is_active: 1 },
          { url: 'https://b.com', title: 'B', position: 1 },
        ],
      }),
    })
    const r = await SELF.fetch('http://baobab/api/tabs', { headers: { Authorization: `Bearer ${access}` } })
    const j = await r.json() as { items: Array<{ url: string }> }
    expect(j.items).toHaveLength(2)
  })
})
