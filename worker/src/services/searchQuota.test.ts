import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { consume } from './searchQuota'

const mockKV = (initial = 0) => {
  let v = initial
  return {
    get: vi.fn(async () => (v === 0 ? null : String(v))),
    put: vi.fn(async (_k: string, val: string) => { v = Number(val) }),
    delete: vi.fn(),
  } as unknown as KVNamespace
}

beforeEach(() => { vi.useFakeTimers().setSystemTime(new Date('2026-05-17T10:00:00Z')) })
afterEach(() => { vi.useRealTimers() })

describe('searchQuota.consume', () => {
  it('returns allowed=true under soft cap', async () => {
    const kv = mockKV(100)
    const r = await consume(kv)
    expect(r.allowed).toBe(true)
    expect(r.fallbackMode).toBeUndefined()
    expect(r.remaining).toBe(10000 - 101)
  })

  it('returns fallbackMode=quota-degraded at soft cap', async () => {
    const kv = mockKV(9501)
    const r = await consume(kv)
    expect(r.allowed).toBe(true)
    expect(r.fallbackMode).toBe('quota-degraded')
  })

  it('returns allowed=false at hard cap', async () => {
    const kv = mockKV(10000)
    const r = await consume(kv)
    expect(r.allowed).toBe(false)
    expect(r.fallbackMode).toBe('ai-only')
  })

  it('uses today date in the KV key', async () => {
    const kv = mockKV(0)
    await consume(kv)
    expect((kv.put as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])
      .toBe('pse:quota:2026-05-17')
  })
})
