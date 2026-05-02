import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

async function signup() {
  const email = `p-${Date.now()}-${Math.random()}@x.com`
  const res = await SELF.fetch('http://baobab/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'long-password-123' }),
  })
  return { ...(await res.json() as { access: string; user: { id: string } }), email }
}

describe('GET /api/auth/me', () => {
  it('returns the authenticated user', async () => {
    const { access, email } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/me', {
      headers: { Authorization: `Bearer ${access}` },
    })
    expect(res.status).toBe(200)
    const u = await res.json() as { email: string; id: string }
    expect(u.email).toBe(email)
  })

  it('returns 401 without Authorization', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/auth/settings', () => {
  it('updates allowed fields', async () => {
    const { access } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'light', low_bandwidth_mode: 1 }),
    })
    expect(res.status).toBe(200)
    const me = await SELF.fetch('http://baobab/api/auth/me', {
      headers: { Authorization: `Bearer ${access}` },
    })
    const u = await me.json() as { theme: string; low_bandwidth_mode: number }
    expect(u.theme).toBe('light')
    expect(u.low_bandwidth_mode).toBe(1)
  })

  it('rejects empty body (400)', async () => {
    const { access } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('silently ignores unknown fields', async () => {
    const { access } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/settings', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      // password_hash is NOT in the allowlist — would be a privilege escalation if it were.
      body: JSON.stringify({ password_hash: 'attacker-controlled', theme: 'light' }),
    })
    expect(res.status).toBe(200)
    const me = await SELF.fetch('http://baobab/api/auth/me', {
      headers: { Authorization: `Bearer ${access}` },
    })
    const u = await me.json() as { password_hash: string | null; theme: string }
    // Allowlisted field updated:
    expect(u.theme).toBe('light')
    // Privileged field untouched (signup set it; settings can't):
    expect(u.password_hash).not.toBe('attacker-controlled')
  })
})

describe('PUT /api/auth/password', () => {
  it('changes password when current is correct', async () => {
    const { access, email } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: 'long-password-123', next: 'new-password-12345' }),
    })
    expect(res.status).toBe(200)
    // Verify old password no longer works:
    const oldLogin = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'long-password-123' }),
    })
    expect(oldLogin.status).toBe(401)
    // And new password does:
    const newLogin = await SELF.fetch('http://baobab/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'new-password-12345' }),
    })
    expect(newLogin.status).toBe(200)
  })

  it('rejects wrong current password (401)', async () => {
    const { access } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: 'wrong-current', next: 'new-password-12345' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects short new password (400)', async () => {
    const { access } = await signup()
    const res = await SELF.fetch('http://baobab/api/auth/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: 'long-password-123', next: 'short' }),
    })
    expect(res.status).toBe(400)
  })

  it('invalidates other active sessions on password change (review fix #3)', async () => {
    const { access } = await signup()

    // Pre-change: token works.
    const before = await SELF.fetch('http://baobab/api/auth/me', {
      headers: { Authorization: `Bearer ${access}` },
    })
    expect(before.status).toBe(200)

    // Change password — bumps pwv:${userId} sentinel.
    const change = await SELF.fetch('http://baobab/api/auth/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: 'long-password-123', next: 'new-password-12345' }),
    })
    expect(change.status).toBe(200)

    // The same access token must now fail. JWT iat predates pwv timestamp.
    // Tokens issued AFTER this point (via /login with the new password) work.
    const after = await SELF.fetch('http://baobab/api/auth/me', {
      headers: { Authorization: `Bearer ${access}` },
    })
    expect(after.status).toBe(401)
  })
})
