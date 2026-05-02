import { SignJWT, jwtVerify, type JWTVerifyOptions } from 'jose'

// Pinned issuer/audience guard against future cross-environment token reuse
// (e.g. a staging-issued token leaked into prod). Bump if the surface ever
// splits (admin tokens, server-to-server, browser-bridge).
const JWT_ISSUER = 'baobab-api'
const JWT_AUDIENCE = 'baobab-app'

export const ACCESS_TTL_SEC = 24 * 60 * 60          // 24h
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60    // 30d
const CLOCK_SKEW_SEC = 5

const enc = new TextEncoder()

const VERIFY_OPTS: JWTVerifyOptions = {
  algorithms: ['HS256'],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  clockTolerance: CLOCK_SKEW_SEC,
}

export interface IssuedTokens {
  access: string
  refresh: string
  accessJti: string
  refreshJti: string
}

export async function issueTokens(secret: string, userId: string): Promise<IssuedTokens> {
  const key = enc.encode(secret)
  const accessJti = crypto.randomUUID()
  const refreshJti = crypto.randomUUID()
  const access = await new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(userId)
    .setJti(accessJti)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(key)
  const refresh = await new SignJWT({ typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(userId)
    .setJti(refreshJti)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SEC}s`)
    .sign(key)
  return { access, refresh, accessJti, refreshJti }
}

export interface VerifiedClaims {
  sub: string
  jti: string
  // Issued-at in seconds since epoch. authMiddleware compares against the
  // per-user password-version sentinel to invalidate pre-password-change tokens.
  iat: number
}

export async function verifyAccess(secret: string, token: string): Promise<VerifiedClaims> {
  const { payload } = await jwtVerify(token, enc.encode(secret), VERIFY_OPTS)
  if (
    payload.typ !== 'access' ||
    !payload.sub ||
    !payload.jti ||
    typeof payload.iat !== 'number'
  ) throw new Error('not an access token')
  return { sub: payload.sub, jti: payload.jti, iat: payload.iat }
}

export async function verifyRefresh(secret: string, token: string): Promise<VerifiedClaims> {
  const { payload } = await jwtVerify(token, enc.encode(secret), VERIFY_OPTS)
  if (
    payload.typ !== 'refresh' ||
    !payload.sub ||
    !payload.jti ||
    typeof payload.iat !== 'number'
  ) throw new Error('not a refresh token')
  return { sub: payload.sub, jti: payload.jti, iat: payload.iat }
}
