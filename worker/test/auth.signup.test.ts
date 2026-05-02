import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('POST /api/auth/signup', () => {
  it('creates user and returns tokens', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'signup@example.com', password: 'long-password-123', display_name: 'A' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { access: string; refresh: string; user: { email: string } }
    expect(body.user.email).toBe('signup@example.com')
    expect(body.access).toBeTruthy()
    expect(body.refresh).toBeTruthy()
  })

  it('rejects duplicate email (409)', async () => {
    await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dup@x.com', password: 'long-password-123' }),
    })
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dup@x.com', password: 'long-password-123' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects short password (400)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'short@x.com', password: '123' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects malformed email (400)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', password: 'long-password-123' }),
    })
    expect(res.status).toBe(400)
  })

  it('normalizes email case (no duplicate via case difference)', async () => {
    await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Case@Example.com', password: 'long-password-123' }),
    })
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'CASE@example.COM', password: 'long-password-123' }),
    })
    expect(res.status).toBe(409)
  })
})
