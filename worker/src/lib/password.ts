// Stored format: pbkdf2-sha256$v1$<iterations>$<base64 salt>$<base64 hash>
// The v1 prefix is a migration anchor — if iterations bump or algorithm
// changes (e.g. argon2id when Workers gains native support), bump to v2 and
// teach verifyPassword to handle both, then re-hash on next successful login.

const ALGO_TAG = 'pbkdf2-sha256'
const VERSION = 'v1'
// Cloudflare Workers' WebCrypto caps PBKDF2 iterations at 100,000:
//   "Pbkdf2 failed: iteration counts above 100000 are not supported"
// OWASP 2023+ guidance is 600k for PBKDF2-SHA256, but the runtime forbids it.
// Compensating defenses already in place: per-IP rate limit on /login (10/min,
// Phase 8), per-phone OTP send cap (3/hr), 5-attempt OTP verify cap, length>=8
// minimum, JTI-keyed sessions with revocation. If the runtime ever lifts the
// cap (compat flag or new Workers WebCrypto rev), bump VERSION -> v2 and add
// a re-hash-on-login migration path.
const ITERATIONS = 100_000
const KEY_LEN = 32
const SALT_LEN = 16

const enc = new TextEncoder()

// Loop instead of spread: spread converts a Uint8Array to function args, which
// V8 caps around 65,536 — fine for current 32-byte hashes but poisonous if
// reused for larger buffers (R2 keys, article hashes, etc).
function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function b64ToBuf(s: string): ArrayBuffer {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = new Uint8Array(SALT_LEN)
  crypto.getRandomValues(salt)
  const key = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_LEN * 8
  )
  return `${ALGO_TAG}$${VERSION}$${ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [algo, version, itersStr, saltB64, hashB64] = stored.split('$')
  if (algo !== ALGO_TAG || version !== VERSION || !itersStr || !saltB64 || !hashB64) return false

  const iters = Number(itersStr)
  if (!Number.isInteger(iters) || iters < 1) return false

  const salt = new Uint8Array(b64ToBuf(saltB64))
  const expected = b64ToBuf(hashB64)
  const key = await crypto.subtle.importKey('raw', enc.encode(plain), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    key,
    KEY_LEN * 8
  )
  return constantTimeEqual(new Uint8Array(bits), new Uint8Array(expected))
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a[i]! ^ b[i]!
  return r === 0
}
