import { SignJWT, jwtVerify } from 'jose'

const ACCESS_TTL_SEC = 24 * 60 * 60         // 24h
const REFRESH_TTL_SEC = 30 * 24 * 60 * 60   // 30d

const enc = new TextEncoder()

export async function issueTokens(secret: string, userId: string): Promise<{ access: string; refresh: string }> {
  const key = enc.encode(secret)
  const access = await new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(key)
  const refresh = await new SignJWT({ typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SEC}s`)
    .sign(key)
  return { access, refresh }
}

export async function verifyAccess(secret: string, token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, enc.encode(secret))
  if (payload.typ !== 'access' || !payload.sub) throw new Error('not an access token')
  return { sub: payload.sub }
}

export async function verifyRefresh(secret: string, token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, enc.encode(secret))
  if (payload.typ !== 'refresh' || !payload.sub) throw new Error('not a refresh token')
  return { sub: payload.sub }
}
