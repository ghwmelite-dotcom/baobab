import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function authedSignup() {
  const email = `aic-${Date.now()}-${Math.random()}@x.com`
  const r = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'long-password-123' }),
  })
  return (await r.json() as { access: string }).access
}

describe('POST /api/ai/chat', () => {
  it('requires auth', async () => {
    const r = await SELF.fetch('http://baobab/api/ai/chat', { method: 'POST' })
    expect(r.status).toBe(401)
  })
  it('returns text-event-stream and stores message', async () => {
    const access = await authedSignup()
    const r = await SELF.fetch('http://baobab/api/ai/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/event-stream')
  })
})
