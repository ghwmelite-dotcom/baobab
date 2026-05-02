import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { SignJWT } from 'jose'
import { issueTokens, verifyAccess, verifyRefresh } from '../src/lib/jwt'

const enc = new TextEncoder()

describe('jwt — happy path', () => {
  it('issued access token verifies and contains user id + jti', async () => {
    const { access, accessJti } = await issueTokens(env.AUTH_SECRET, 'user_123')
    const claims = await verifyAccess(env.AUTH_SECRET, access)
    expect(claims.sub).toBe('user_123')
    expect(claims.jti).toBe(accessJti)
  })

  it('refresh token is distinct from access token', async () => {
    const { access, refresh } = await issueTokens(env.AUTH_SECRET, 'user_123')
    expect(access).not.toBe(refresh)
    const claims = await verifyRefresh(env.AUTH_SECRET, refresh)
    expect(claims.sub).toBe('user_123')
  })
})

describe('jwt — adversarial', () => {
  it('rejects token signed with a different secret', async () => {
    const { access } = await issueTokens('a-different-secret', 'user_evil')
    await expect(verifyAccess(env.AUTH_SECRET, access)).rejects.toThrow()
  })

  it('rejects token with a tampered signature', async () => {
    const { access } = await issueTokens(env.AUTH_SECRET, 'user_123')
    // Flip the last char of the signature segment.
    const segs = access.split('.')
    const sig = segs[2]!
    const tampered = `${segs[0]}.${segs[1]}.${sig.slice(0, -1)}${sig.slice(-1) === 'A' ? 'B' : 'A'}`
    await expect(verifyAccess(env.AUTH_SECRET, tampered)).rejects.toThrow()
  })

  it('rejects refresh token passed to verifyAccess (typ guard)', async () => {
    const { refresh } = await issueTokens(env.AUTH_SECRET, 'user_123')
    await expect(verifyAccess(env.AUTH_SECRET, refresh)).rejects.toThrow()
  })

  it('rejects access token passed to verifyRefresh (typ guard)', async () => {
    const { access } = await issueTokens(env.AUTH_SECRET, 'user_123')
    await expect(verifyRefresh(env.AUTH_SECRET, access)).rejects.toThrow()
  })

  it('rejects expired token', async () => {
    // Hand-craft a token with exp in the past, using same secret + correct
    // typ/iss/aud claims so the only failure mode is expiration.
    const expired = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('baobab-api')
      .setAudience('baobab-app')
      .setSubject('user_123')
      .setJti(crypto.randomUUID())
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2h ago
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // 1h ago
      .sign(enc.encode(env.AUTH_SECRET))
    await expect(verifyAccess(env.AUTH_SECRET, expired)).rejects.toThrow()
  })

  it('rejects token with wrong issuer', async () => {
    const wrongIss = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('attacker-api')
      .setAudience('baobab-app')
      .setSubject('user_evil')
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(enc.encode(env.AUTH_SECRET))
    await expect(verifyAccess(env.AUTH_SECRET, wrongIss)).rejects.toThrow()
  })

  it('rejects token with wrong audience', async () => {
    const wrongAud = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('baobab-api')
      .setAudience('attacker-app')
      .setSubject('user_evil')
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(enc.encode(env.AUTH_SECRET))
    await expect(verifyAccess(env.AUTH_SECRET, wrongAud)).rejects.toThrow()
  })

  it('rejects token missing jti claim', async () => {
    const noJti = await new SignJWT({ typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('baobab-api')
      .setAudience('baobab-app')
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(enc.encode(env.AUTH_SECRET))
    await expect(verifyAccess(env.AUTH_SECRET, noJti)).rejects.toThrow()
  })

  it('rejects garbage token', async () => {
    await expect(verifyAccess(env.AUTH_SECRET, 'not.a.jwt')).rejects.toThrow()
    await expect(verifyAccess(env.AUTH_SECRET, '')).rejects.toThrow()
  })
})
