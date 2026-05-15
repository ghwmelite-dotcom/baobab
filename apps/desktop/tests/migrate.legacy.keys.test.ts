import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// In-memory persistence mock (shared by persistence and profileScoped)
// ---------------------------------------------------------------------------
const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }))

vi.mock('~/state/persistence', () => {
  const persistence = {
    get: vi.fn((key: string) => Promise.resolve(store.has(key) ? store.get(key) : undefined)),
    set: vi.fn((key: string, value: unknown) => { store.set(key, value); return Promise.resolve() }),
    delete: vi.fn((key: string) => { store.delete(key); return Promise.resolve() }),
  }
  const profileScoped = (profileId: string) => {
    const prefix = `profile.${profileId}.`
    return {
      get: (key: string) => persistence.get(prefix + key),
      set: (key: string, value: unknown) => persistence.set(prefix + key, value),
      delete: (key: string) => persistence.delete(prefix + key),
    }
  }
  return { persistence, profileScoped }
})

import { migrateLegacyAuthKeys } from '~/profiles/migrateLegacyKeys'
import { persistence } from '~/state/persistence'

const PROFILE_ID = 'test-profile-123'
const FLAG = 'frontend.migration.v1.completed'

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
})

describe('migrateLegacyAuthKeys', () => {
  it('copies legacy auth.accessToken into profile-scoped key', async () => {
    store.set('auth.accessToken', 'legacy-access-token')

    await migrateLegacyAuthKeys(PROFILE_ID)

    expect(store.get(`profile.${PROFILE_ID}.auth.accessToken`)).toBe('legacy-access-token')
  })

  it('copies legacy auth.refreshToken into profile-scoped key', async () => {
    store.set('auth.refreshToken', 'legacy-refresh-token')

    await migrateLegacyAuthKeys(PROFILE_ID)

    expect(store.get(`profile.${PROFILE_ID}.auth.refreshToken`)).toBe('legacy-refresh-token')
  })

  it('deletes legacy keys after copying', async () => {
    store.set('auth.accessToken', 'tok-a')
    store.set('auth.refreshToken', 'tok-r')

    await migrateLegacyAuthKeys(PROFILE_ID)

    expect(store.has('auth.accessToken')).toBe(false)
    expect(store.has('auth.refreshToken')).toBe(false)
  })

  it('sets the migration flag after running', async () => {
    store.set('auth.accessToken', 'tok')

    await migrateLegacyAuthKeys(PROFILE_ID)

    expect(store.get(FLAG)).toBe(true)
  })

  it('is idempotent — does not re-process when flag is already set', async () => {
    store.set(FLAG, true)
    // Simulate some leftover legacy key (should not be touched on second run)
    store.set('auth.accessToken', 'stale')

    await migrateLegacyAuthKeys(PROFILE_ID)

    // The flag was already set, so migration should short-circuit
    // and not copy or delete anything.
    expect(store.has(`profile.${PROFILE_ID}.auth.accessToken`)).toBe(false)
    expect(store.has('auth.accessToken')).toBe(true) // untouched
    // persistence.get is called once (for the flag check) and then returns early
    expect(persistence.set).not.toHaveBeenCalled()
    expect(persistence.delete).not.toHaveBeenCalled()
  })

  it('short-circuits for guest profile without touching the store', async () => {
    store.set('auth.accessToken', 'tok')

    await migrateLegacyAuthKeys('guest')

    // No reads or writes at all for guest
    expect(persistence.get).not.toHaveBeenCalled()
    expect(persistence.set).not.toHaveBeenCalled()
    expect(persistence.delete).not.toHaveBeenCalled()
  })

  it('handles missing legacy keys gracefully (partial upgrade)', async () => {
    // Only accessToken is present; refreshToken was never written
    store.set('auth.accessToken', 'only-access')

    await migrateLegacyAuthKeys(PROFILE_ID)

    expect(store.get(`profile.${PROFILE_ID}.auth.accessToken`)).toBe('only-access')
    // refreshToken was absent — scoped key should not be set either
    expect(store.has(`profile.${PROFILE_ID}.auth.refreshToken`)).toBe(false)
    expect(store.get(FLAG)).toBe(true)
  })
})
