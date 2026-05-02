import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { issueTokens, verifyAccess, verifyRefresh } from '../src/lib/jwt'

describe('jwt', () => {
  it('issued access token verifies and contains user id', async () => {
    const { access } = await issueTokens(env.AUTH_SECRET, 'user_123')
    const claims = await verifyAccess(env.AUTH_SECRET, access)
    expect(claims.sub).toBe('user_123')
  })
  it('refresh token is distinct from access token', async () => {
    const { access, refresh } = await issueTokens(env.AUTH_SECRET, 'user_123')
    expect(access).not.toBe(refresh)
    const claims = await verifyRefresh(env.AUTH_SECRET, refresh)
    expect(claims.sub).toBe('user_123')
  })
})
