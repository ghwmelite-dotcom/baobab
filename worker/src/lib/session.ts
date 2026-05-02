import type { Env } from '../types'
import { issueTokens, ACCESS_TTL_SEC, REFRESH_TTL_SEC, type IssuedTokens } from './jwt'

// Centralized session lifecycle. Every code path that mints tokens MUST go
// through startSession so SESSIONS KV stays the source of truth on what's
// active. endSession revokes by jti.
//
// Session-record shape is intentionally minimal — { userId } — but leaves
// room for { issuedAt, ip, ua, deviceId } when device-binding lands.

interface SessionRecord {
  userId: string
}

const ACCESS_SESSION = (jti: string) => `session:${jti}`
const REFRESH_SESSION = (jti: string) => `refresh:${jti}`

export async function startSession(env: Env, userId: string): Promise<IssuedTokens> {
  const tokens = await issueTokens(env.AUTH_SECRET, userId)
  const record: SessionRecord = { userId }
  await env.SESSIONS.put(ACCESS_SESSION(tokens.accessJti), JSON.stringify(record), {
    expirationTtl: ACCESS_TTL_SEC,
  })
  await env.SESSIONS.put(REFRESH_SESSION(tokens.refreshJti), JSON.stringify(record), {
    expirationTtl: REFRESH_TTL_SEC,
  })
  return tokens
}

export async function endAccessSession(env: Env, accessJti: string): Promise<void> {
  await env.SESSIONS.delete(ACCESS_SESSION(accessJti))
}

// Refresh rotation: caller has verified the refresh JWT signature; we then
// confirm the refresh session record is still active (not already rotated /
// revoked), delete it, and start a fresh session pair. Returns null if the
// refresh has already been used or revoked.
export async function rotateRefresh(env: Env, refreshJti: string, userId: string): Promise<IssuedTokens | null> {
  const existing = await env.SESSIONS.get(REFRESH_SESSION(refreshJti))
  if (!existing) return null
  await env.SESSIONS.delete(REFRESH_SESSION(refreshJti))
  return startSession(env, userId)
}
