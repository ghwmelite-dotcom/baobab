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
  it('passes with valid bearer token', async () => {
    const { access } = await issueTokens(env.AUTH_SECRET, 'user_xyz')
    const res = await makeApp().request('/me', { headers: { Authorization: `Bearer ${access}` } }, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: 'user_xyz' })
  })
})
