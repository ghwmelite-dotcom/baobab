import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { newId, getUserById, insertUser } from '../src/lib/db'

describe('db helpers', () => {
  it('newId returns a 26-char ULID', () => {
    const id = newId()
    expect(id).toHaveLength(26)
  })

  it('insertUser + getUserById roundtrip', async () => {
    const id = newId()
    await insertUser(env.DB, { id, email: 'a@b.com', display_name: 'A' })
    const u = await getUserById(env.DB, id)
    expect(u?.email).toBe('a@b.com')
  })
})
