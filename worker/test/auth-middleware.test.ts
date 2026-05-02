import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { env } from 'cloudflare:test'
import { issueTokens } from '../src/lib/jwt'
import { authMiddleware } from '../src/middleware/auth'
import type { AppContext } from '../src/types'

function makeApp() {
  const app = new Hono<AppContext>()
  app.use('*', authMiddleware)
  app.get('/me', (c) => c.json({ userId: c.get('userId') }))
  return app
}

describe('auth middleware', () => {
  it('returns 401 without bearer token', async () => {
    const res = await makeApp().request('/me', {}, env)
    expect(res.status).toBe(401)
  })

  it('passes with valid bearer token + active session', async () => {
    const { access, accessJti } = await issueTokens(env.AUTH_SECRET, 'user_xyz')
    await env.SESSIONS.put(`session:${accessJti}`, JSON.stringify({ userId: 'user_xyz' }))
    const res = await makeApp().request('/me', { headers: { Authorization: `Bearer ${access}` } }, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'user_xyz' })
  })

  it('returns 401 when session has been revoked (deleted from KV)', async () => {
    const { access, accessJti } = await issueTokens(env.AUTH_SECRET, 'user_revoked')
    await env.SESSIONS.put(`session:${accessJti}`, JSON.stringify({ userId: 'user_revoked' }))
    await env.SESSIONS.delete(`session:${accessJti}`)
    const res = await makeApp().request('/me', { headers: { Authorization: `Bearer ${access}` } }, env)
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT is valid but no session record exists (cache poisoning prevented)', async () => {
    // Simulate an attacker putting a forged session record under a jti they
    // chose, then trying to authenticate without a real signed JWT.
    await env.SESSIONS.put('session:attacker-chosen-jti', JSON.stringify({ userId: 'attacker' }))
    // The JWT they'd need to forge requires the AUTH_SECRET they don't have.
    // Issue a real JWT for someone else and try to ride it — sessions check
    // happens AFTER signature verification.
    const { access } = await issueTokens(env.AUTH_SECRET, 'real_user')
    // No session:${realJti} put — so 401 expected, even though a fake session
    // exists at a different key.
    const res = await makeApp().request('/me', { headers: { Authorization: `Bearer ${access}` } }, env)
    expect(res.status).toBe(401)
  })

  it('rejects malformed Bearer headers', async () => {
    const cases = [
      'BearerXYZ',                     // no space
      'bearer abc.def.ghi',            // wrong case
      'Bearer ',                       // empty token
      'Bearer  doublespace.token.sig', // jose may or may not parse, but our trim catches it
      'Token abc.def.ghi',             // wrong scheme
    ]
    for (const auth of cases) {
      const res = await makeApp().request('/me', { headers: { Authorization: auth } }, env)
      expect(res.status).toBe(401)
    }
  })
})
