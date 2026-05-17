import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = new Map<string, unknown>()
const storeApi = {
  get: vi.fn(async (k: string) => store.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { store.set(k, v); return undefined }),
  delete: vi.fn(async (k: string) => { store.delete(k); return undefined }),
  save: vi.fn(async () => undefined),
}
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => storeApi),
}))

import { persistence, profileScoped, GLOBAL_KEYS } from '~/state/persistence'

beforeEach(() => { store.clear(); vi.clearAllMocks() })

describe('profileScoped persistence', () => {
  it('writes to a namespaced key', async () => {
    const ns = profileScoped('abc')
    await ns.set('auth.accessToken', 'tok')
    expect(storeApi.set).toHaveBeenCalledWith('profile.abc.auth.accessToken', 'tok')
  })

  it('reads from the namespaced key', async () => {
    store.set('profile.abc.auth.accessToken', 'tok')
    const ns = profileScoped('abc')
    expect(await ns.get('auth.accessToken')).toBe('tok')
  })

  it('delete removes the namespaced key', async () => {
    store.set('profile.abc.auth.accessToken', 'tok')
    await profileScoped('abc').delete('auth.accessToken')
    expect(storeApi.delete).toHaveBeenCalledWith('profile.abc.auth.accessToken')
  })

  it('GLOBAL_KEYS bypasses the namespace', async () => {
    expect(GLOBAL_KEYS).toContain('picker.showOnStartup')
    await persistence.set('picker.showOnStartup', true)
    expect(storeApi.set).toHaveBeenCalledWith('picker.showOnStartup', true)
  })
})
