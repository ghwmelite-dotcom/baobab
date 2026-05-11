import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `c-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('conversations', () => {
  it('create then list', async () => {
    const access = await token()
    const r = await SELF.fetch('http://baobab/api/conversations', {
      method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Convo' }),
    })
    const created = await r.json() as { id: string }
    expect(created.id).toBeTruthy()
    const list = await SELF.fetch('http://baobab/api/conversations', { headers: { Authorization: `Bearer ${access}` } })
    const j = await list.json() as { items: Array<{ id: string }> }
    expect(j.items.some((c) => c.id === created.id)).toBe(true)
  })
})
