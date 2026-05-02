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
})
