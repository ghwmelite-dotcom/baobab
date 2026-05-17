import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => undefined),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
  ipcTabGoBack: vi.fn(async () => undefined),
  ipcTabGoForward: vi.fn(async () => undefined),
}))

const recordVisit = vi.fn(async () => undefined)
vi.mock('~/history/history.store', () => ({
  useHistoryStore: {
    getState: () => ({ recordVisit }),
  },
}))

vi.mock('~/state/persistence', () => {
  const store = new Map<string, unknown>()
  const persistence = {
    get: vi.fn((key: string) => Promise.resolve(store.get(key))),
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

import { useTabsStore } from '~/state/tabs.store'
import * as ipc from '~/ipc/tabs'

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeId: null, history: {} })
  useTabsStore.getState().setProfileId('test-profile')
  vi.clearAllMocks()
})

describe('private (incognito) tabs', () => {
  it('openIncognitoTab marks the tab incognito and forwards incognito=true to IPC', async () => {
    const id = await useTabsStore.getState().openIncognitoTab('https://secret.com')
    const tab = useTabsStore.getState().tabs.find((t) => t.id === id)
    expect(tab).toBeDefined()
    expect(tab?.incognito).toBe(true)

    expect(ipc.ipcCreateTab).toHaveBeenCalledTimes(1)
    expect(ipc.ipcCreateTab).toHaveBeenCalledWith(id, 'https://secret.com', true)
  })

  it('openTab without opts does NOT set incognito and passes incognito=false to IPC', async () => {
    const id = await useTabsStore.getState().openTab('https://public.com')
    const tab = useTabsStore.getState().tabs.find((t) => t.id === id)
    expect(tab?.incognito).toBeUndefined()
    expect(ipc.ipcCreateTab).toHaveBeenCalledWith(id, 'https://public.com', false)
  })

  it('openIncognitoTab does NOT record a visit, even for a real URL', async () => {
    await useTabsStore.getState().openIncognitoTab('https://secret.com')
    expect(recordVisit).not.toHaveBeenCalled()
  })

  it('navigating an incognito tab does NOT record a visit', async () => {
    const id = await useTabsStore.getState().openIncognitoTab('about:blank')
    recordVisit.mockClear()
    await useTabsStore.getState().navigate(id, 'https://secret.com')
    expect(recordVisit).not.toHaveBeenCalled()
  })

  it('navigating a regular tab DOES record a visit', async () => {
    const id = await useTabsStore.getState().openTab('about:blank')
    recordVisit.mockClear()
    await useTabsStore.getState().navigate(id, 'https://public.com')
    expect(recordVisit).toHaveBeenCalledTimes(1)
    expect(recordVisit).toHaveBeenCalledWith('https://public.com')
  })

  it('opening a regular tab to a real URL DOES record a visit', async () => {
    await useTabsStore.getState().openTab('https://public.com')
    expect(recordVisit).toHaveBeenCalledWith('https://public.com')
  })
})
