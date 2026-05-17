import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function signup(email: string, password = 'long-password-123') {
  await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

describe('POST /api/auth/login', () => {
  it('login succeeds after signup', async () => {
    const email = `login-${Date.now()}@x.com`
    await signup(email)
    const res = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'long-password-123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { access: string; user: { email: string } }
    expect(body.user.email).toBe(email)
    expect(body.access).toBeTruthy()
  })

  it('login fails on wrong password (401)', async () => {
    const email = `wrong-${Date.now()}@x.com`
    await signup(email)
    const res = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('login fails for non-existent email (401, not 404 — no user enumeration)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `noone-${Date.now()}@x.com`, password: 'long-password-123' }),
    })
    expect(res.status).toBe(401)
  })

  it('login is case-insensitive on email', async () => {
    const email = `caseins-${Date.now()}@x.com`
    await signup(email)
    const res = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toUpperCase(), password: 'long-password-123' }),
    })
    expect(res.status).toBe(200)
  })

  it('login via phone succeeds after phone signup', async () => {
    const phone = `+23355502${String(Date.now()).slice(-4)}`
    const signupRes = await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: 'long-password-123' }),
    })
    expect(signupRes.status).toBe(200)
    const res = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: 'long-password-123' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { access: string; user: { phone: string } }
    expect(body.user.phone).toBe(phone)
    expect(body.access).toBeTruthy()
  })

  it('login via phone with wrong password (401)', async () => {
    const phone = `+23355503${String(Date.now()).slice(-4)}`
    await SELF.fetch('http://baobab/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: 'long-password-123' }),
    })
    const res = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password: 'wrong-password-xx' }),
    })
    expect(res.status).toBe(401)
  })
})
