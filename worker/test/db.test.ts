import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { newId, getUserById, insertUser } from '../src/lib/db'

describe('db helpers', () => {
  it('newId returns a 21-char URL-safe id', () => {
    const id = newId()
    expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/)
  })

  it('newId is collision-free across 10k samples', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 10_000; i++) ids.add(newId())
    expect(ids.size).toBe(10_000)
  })

  it('insertUser + getUserById roundtrip', async () => {
    const id = newId()
    await insertUser(env.DB, { id, email: 'roundtrip@example.com', display_name: 'A' })
    const u = await getUserById(env.DB, id)
    expect(u?.email).toBe('roundtrip@example.com')
  })

  it('insertUser throws on duplicate email (UNIQUE constraint)', async () => {
    await insertUser(env.DB, { id: newId(), email: 'dup@example.com' })
    await expect(
      insertUser(env.DB, { id: newId(), email: 'dup@example.com' })
    ).rejects.toThrow()
  })

  it('insertUser throws on duplicate phone (UNIQUE constraint)', async () => {
    await insertUser(env.DB, { id: newId(), phone: '+233241000001' })
    await expect(
      insertUser(env.DB, { id: newId(), phone: '+233241000001' })
    ).rejects.toThrow()
  })
})
