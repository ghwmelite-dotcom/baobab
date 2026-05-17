import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('~/state/persistence', () => {
  const store = new Map<string, unknown>()
  const persistence = {
    get: vi.fn((k: string) => Promise.resolve(store.get(k))),
    set: vi.fn((k: string, v: unknown) => { store.set(k, v); return Promise.resolve() }),
    delete: vi.fn((k: string) => { store.delete(k); return Promise.resolve() }),
  }
  const profileScoped = (id: string) => {
    const prefix = `profile.${id}.`
    return {
      get: (k: string) => persistence.get(prefix + k),
      set: (k: string, v: unknown) => persistence.set(prefix + k, v),
      delete: (k: string) => persistence.delete(prefix + k),
    }
  }
  return { persistence, profileScoped }
})

import { useDataStore } from '~/data/data.store'

beforeEach(() => {
  useDataStore.setState({ history: [], budgetMb: 500 })
  useDataStore.getState().setProfileId('p1')
})

describe('data.store', () => {
  it('creates today\'s bucket on first recordUsage', () => {
    useDataStore.getState().recordUsage(1000, 200)
    const today = useDataStore.getState().today()
    expect(today.bytesUsed).toBe(1000)
    expect(today.bytesSaved).toBe(200)
  })

  it('accumulates into the same bucket across calls', () => {
    useDataStore.getState().recordUsage(1000, 200)
    useDataStore.getState().recordUsage(500, 100)
    const today = useDataStore.getState().today()
    expect(today.bytesUsed).toBe(1500)
    expect(today.bytesSaved).toBe(300)
  })

  it('returns a fresh bucket on a new day', () => {
    // Force a stale yesterday bucket.
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')
    useDataStore.setState({ history: [{ dateKey: yesterday, bytesUsed: 9999, bytesSaved: 0 }] })
    useDataStore.getState().recordUsage(100, 50)
    const today = useDataStore.getState().today()
    expect(today.bytesUsed).toBe(100)
    expect(useDataStore.getState().history.length).toBe(2)
  })

  it('trims history past 30 days', () => {
    const history = Array.from({ length: 40 }, (_, i) => ({
      dateKey: `2026-01-${String(i + 1).padStart(2, '0')}`,
      bytesUsed: 0, bytesSaved: 0,
    }))
    useDataStore.setState({ history })
    useDataStore.getState().recordUsage(1, 0)
    expect(useDataStore.getState().history.length).toBeLessThanOrEqual(30)
  })

  it('percentUsedToday respects the budget', () => {
    useDataStore.getState().setBudget(1) // 1 MB
    useDataStore.getState().recordUsage(512 * 1024, 0) // 512 KB
    expect(useDataStore.getState().percentUsedToday()).toBeCloseTo(50, 0)
  })
})
