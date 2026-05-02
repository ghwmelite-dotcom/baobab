import type { Env } from '../types'
import { issueTokens, ACCESS_TTL_SEC, REFRESH_TTL_SEC, type IssuedTokens } from './jwt'

// Centralized session lifecycle. Every code path that mints tokens MUST go
// through startSession so SESSIONS KV stays the source of truth on what's
// active. Access and refresh records cross-reference each other so endSession
// can revoke both with the access jti alone.
//
// Key shapes:
//   session:${accessJti}    -> { userId, refreshJti }   TTL = ACCESS_TTL_SEC
//   refresh:${refreshJti}   -> { userId, accessJti }    TTL = REFRESH_TTL_SEC
//   pwv:${userId}           -> ms timestamp string      TTL = REFRESH_TTL_SEC
//
// pwv (password-version) is bumped on password change. authMiddleware checks
// if the JWT iat is older than pwv and rejects — this enforces OWASP ASVS
// 3.5.7 "password change invalidates active sessions" without requiring a
// scan-and-delete over user_sessions:* indexes.

interface AccessSessionRecord {
  userId: string
  refreshJti: string
}

interface RefreshSessionRecord {
  userId: string
  accessJti: string
}

const ACCESS_KEY = (jti: string) => `session:${jti}`
const REFRESH_KEY = (jti: string) => `refresh:${jti}`
const PWV_KEY = (userId: string) => `pwv:${userId}`

export async function startSession(env: Env, userId: string): Promise<IssuedTokens> {
  const tokens = await issueTokens(env.AUTH_SECRET, userId)
  const accessRecord: AccessSessionRecord = { userId, refreshJti: tokens.refreshJti }
  const refreshRecord: RefreshSessionRecord = { userId, accessJti: tokens.accessJti }
  await Promise.all([
    env.SESSIONS.put(ACCESS_KEY(tokens.accessJti), JSON.stringify(accessRecord), {
      expirationTtl: ACCESS_TTL_SEC,
    }),
    env.SESSIONS.put(REFRESH_KEY(tokens.refreshJti), JSON.stringify(refreshRecord), {
      expirationTtl: REFRESH_TTL_SEC,
    }),
  ])
  return tokens
}

// Revokes the access session AND its paired refresh, so a logged-out token
// can't be /refresh'd back into use.
export async function endSession(env: Env, accessJti: string): Promise<void> {
  const raw = await env.SESSIONS.get(ACCESS_KEY(accessJti))
  let refreshJti: string | undefined
  if (raw) {
    try {
      const rec = JSON.parse(raw) as AccessSessionRecord
      refreshJti = rec.refreshJti
    } catch {
      // Malformed record — proceed with access-only delete.
    }
  }
  await Promise.all([
    env.SESSIONS.delete(ACCESS_KEY(accessJti)),
    refreshJti ? env.SESSIONS.delete(REFRESH_KEY(refreshJti)) : Promise.resolve(),
  ])
}

// Refresh rotation: caller has verified the refresh JWT signature; we then
// confirm the refresh session record is still active (not already rotated /
// revoked), delete it AND its paired access session, and start a fresh pair.
// Returns null if the refresh has already been used or revoked.
//
// Known limitation: KV has no compare-and-delete, so two concurrent rotations
// of the same refresh can both pass the `existing` check and both succeed.
// Acceptable trade-off for P0; tracked for a Durable Object based atomic
// rotation in a future hardening pass.
export async function rotateRefresh(env: Env, refreshJti: string, userId: string): Promise<IssuedTokens | null> {
  const raw = await env.SESSIONS.get(REFRESH_KEY(refreshJti))
  if (!raw) return null

  let pairedAccessJti: string | undefined
  try {
    const rec = JSON.parse(raw) as RefreshSessionRecord
    pairedAccessJti = rec.accessJti
  } catch {
    // Malformed record — still revoke and proceed with rotation.
  }

  await Promise.all([
    env.SESSIONS.delete(REFRESH_KEY(refreshJti)),
    pairedAccessJti ? env.SESSIONS.delete(ACCESS_KEY(pairedAccessJti)) : Promise.resolve(),
  ])
  return startSession(env, userId)
}

// Bump the per-user password-version sentinel. authMiddleware reads this and
// rejects any token whose JWT iat is older. The TTL matches REFRESH_TTL so the
// sentinel outlives any token that could possibly have been issued before it.
export async function bumpPasswordVersion(env: Env, userId: string): Promise<void> {
  await env.SESSIONS.put(PWV_KEY(userId), String(Date.now()), {
    expirationTtl: REFRESH_TTL_SEC,
  })
}

export async function getPasswordVersion(env: Env, userId: string): Promise<number | null> {
  const raw = await env.SESSIONS.get(PWV_KEY(userId))
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
