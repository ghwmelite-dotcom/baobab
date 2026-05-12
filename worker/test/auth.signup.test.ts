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

  it('signs up via phone and returns tokens (no SMS, no OTP)', async () => {
    const phone = `+23355500${String(Date.now()).slice(-4)}`
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: 'long-password-123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { access: string; refresh: string; user: { phone: string; email: string | null } }
    expect(body.user.phone).toBe(phone)
    expect(body.user.email).toBeNull()
    expect(body.access).toBeTruthy()
    expect(body.refresh).toBeTruthy()

    // /me reflects phone-only user
    const me = await SELF.fetch('http://baobab/api/auth/me', {
      headers: { Authorization: `Bearer ${body.access}` },
    })
    expect(me.status).toBe(200)
    const meBody = await me.json() as { email: string | null; phone: string | null }
    expect(meBody.phone).toBe(phone)
    expect(meBody.email).toBeNull()
  })

  it('rejects duplicate phone (409)', async () => {
    const phone = `+23355501${String(Date.now()).slice(-4)}`
    await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: 'long-password-123' }),
    })
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: 'long-password-123' }),
    })
    expect(res.status).toBe(409)
  })

  it('rejects missing identifier (400)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'long-password-123' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects malformed phone (400)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0241112222', password: 'long-password-123' }),
    })
    expect(res.status).toBe(400)
  })
})
