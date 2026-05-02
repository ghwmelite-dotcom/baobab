const ITERATIONS = 100_000
const KEY_LEN = 32
const SALT_LEN = 16

const enc = new TextEncoder()

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
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
  return `pbkdf2$${ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iters = Number(parts[1])
  const salt = new Uint8Array(b64ToBuf(parts[2]!))
  const expected = b64ToBuf(parts[3]!)
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
