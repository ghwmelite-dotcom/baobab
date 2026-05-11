import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function token() {
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `as-${Math.random()}@x.com`, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('assets', () => {
  it('upload then download roundtrip', async () => {
    const access = await token()
    const up = await SELF.fetch('http://baobab/api/assets/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'image/png' },
      body: new Uint8Array([1, 2, 3, 4]),
    })
    const r = await up.json() as { key: string }
    expect(r.key).toBeTruthy()
    const dl = await SELF.fetch(`http://baobab/api/assets/${r.key}`, { headers: { Authorization: `Bearer ${access}` } })
    expect(dl.status).toBe(200)
    expect(dl.headers.get('content-type')).toBe('image/png')
  })
})
