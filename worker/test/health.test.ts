import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('health', () => {
  it('GET / returns 200 with app info', async () => {
    const res = await SELF.fetch('http://baobab/')
    expect(res.status).toBe(200)
    const body = await res.json() as { name: string; version: string }
    expect(body.name).toBe('Baobab')
    expect(body.version).toBe('0.0.1')
  })
})
