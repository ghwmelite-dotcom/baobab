import { describe, it, expect, vi } from 'vitest'
import { cacheKey, cacheGet, cacheSet } from './searchCache'

const mockKV = () => {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string, _opts?: unknown) => { store.set(k, v) }),
    delete: vi.fn(async (k: string) => { store.delete(k) }),
  }
}

describe('searchCache.cacheKey', () => {
  it('produces stable key for same inputs', async () => {
    const a = await cacheKey('paystack', null, [])
    const b = await cacheKey('paystack', null, [])
    expect(a).toBe(b)
  })

  it('differs for different queries', async () => {
    expect(await cacheKey('a', null, [])).not.toBe(await cacheKey('b', null, []))
  })

  it('differs for different target languages', async () => {
    expect(await cacheKey('q', 'yo', [])).not.toBe(await cacheKey('q', null, []))
  })

  it('differs for different contextChains', async () => {
    const c1 = [{ query: 'x', answer: 'y' }]
    const c2 = [{ query: 'x', answer: 'z' }]
    expect(await cacheKey('q', null, c1)).not.toBe(await cacheKey('q', null, c2))
  })
})

describe('searchCache.cacheGet/Set', () => {
  it('round-trips a response object', async () => {
    const kv = mockKV() as unknown as KVNamespace
    const key = 'k1'
    const value = { foo: 'bar', n: 1 }
    await cacheSet(kv, key, value, 86400)
    const got = await cacheGet<typeof value>(kv, key)
    expect(got).toEqual(value)
  })

  it('returns null on cache miss', async () => {
    const kv = mockKV() as unknown as KVNamespace
    expect(await cacheGet(kv, 'missing')).toBeNull()
  })

  it('passes ttl as expirationTtl', async () => {
    const kv = mockKV() as unknown as KVNamespace
    await cacheSet(kv, 'k', { x: 1 }, 3600)
    expect((kv.put as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][2])
      .toEqual({ expirationTtl: 3600 })
  })
})
