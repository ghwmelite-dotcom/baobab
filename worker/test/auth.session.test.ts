import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function signup() {
  const email = `s-${Date.now()}-${Math.random()}@x.com`
  const res = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'long-password-123' }),
  })
  return res.json() as Promise<{ access: string; refresh: string }>
}

async function getMe(access: string) {
  return SELF.fetch('http://baobab/api/auth/me', {
    headers: { Authorization: `Bearer ${access}` },
  })
}

describe('POST /api/auth/refresh', () => {
  it('issues a new pair and rotates the refresh', async () => {
    const { refresh } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    expect(res.status).toBe(200)
    const next = await res.json() as { access: string; refresh: string }
    expect(next.access).toBeTruthy()
    expect(next.refresh).not.toBe(refresh)
  })

  it('rejects already-rotated refresh (cannot reuse)', async () => {
    const { refresh } = await signup()
    // First rotation succeeds.
    const r1 = await SELF.fetch('http://baobab/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    expect(r1.status).toBe(200)
    // Reuse of the original refresh must be rejected — the refresh KV record
    // was deleted by the first rotation.
    const r2 = await SELF.fetch('http://baobab/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    expect(r2.status).toBe(401)
  })

  it('rejects access token passed as refresh (typ guard)', async () => {
    const { access } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: access }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects garbage refresh', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: 'not.a.jwt' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects missing refresh body (400)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/logout', () => {
  it('invalidates the access token (next /me returns 401)', async () => {
    const { access } = await signup()

    // Confirm /me works pre-logout.
    const before = await getMe(access)
    expect(before.status).toBe(200)

    const out = await SELF.fetch('http://baobab/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}` },
    })
    expect(out.status).toBe(200)

    // The same access token must now fail because session:${jti} is gone.
    const after = await getMe(access)
    expect(after.status).toBe(401)
  })

  it('rejects logout without bearer (401 from authMiddleware)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/logout', { method: 'POST' })
    expect(res.status).toBe(401)
  })
})
