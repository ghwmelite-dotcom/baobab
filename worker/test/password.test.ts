import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/lib/password'

describe('password', () => {
  it('hashed password verifies correctly', async () => {
    const h = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })
  it('produces different hashes for same input (random salt)', async () => {
    const h1 = await hashPassword('same')
    const h2 = await hashPassword('same')
    expect(h1).not.toBe(h2)
  })

  it('uses the v1 versioned format', async () => {
    const h = await hashPassword('whatever')
    expect(h).toMatch(/^pbkdf2-sha256\$v1\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
  })

  it('verifyPassword rejects malformed stored hashes without throwing', async () => {
    const cases = [
      '',                                   // empty
      'not-a-hash',                         // no $
      'pbkdf2-sha256$v1$100',               // too few segments
      'pbkdf2-sha256$v1$100$salt$hash$x',   // too many segments
      'argon2id$v1$3$salt$hash',            // wrong algo
      'pbkdf2-sha256$v0$100$salt$hash',     // wrong version (v0)
      'pbkdf2-sha256$v1$abc$salt$hash',     // non-numeric iterations
      'pbkdf2-sha256$v1$-1$salt$hash',      // negative iterations
      'pbkdf2-sha256$v1$0$salt$hash',       // zero iterations
    ]
    for (const stored of cases) {
      await expect(verifyPassword('any', stored)).resolves.toBe(false)
    }
  })
})
