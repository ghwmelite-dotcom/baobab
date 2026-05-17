import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => undefined),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
  ipcTabGoBack: vi.fn(async () => undefined),
  ipcTabGoForward: vi.fn(async () => undefined),
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

describe('tabs history (Back / Forward)', () => {
  it('new tab starts with no history', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    expect(useTabsStore.getState().canGoBack(id)).toBe(false)
    expect(useTabsStore.getState().canGoForward(id)).toBe(false)
  })

  it('canGoBack becomes true after navigating', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    await useTabsStore.getState().navigate(id, 'https://b.com')
    await useTabsStore.getState().navigate(id, 'https://c.com')
    expect(useTabsStore.getState().canGoBack(id)).toBe(true)
    expect(useTabsStore.getState().canGoForward(id)).toBe(false)
  })

  it('goBack invokes IPC and updates depth so canGoForward becomes true', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    await useTabsStore.getState().navigate(id, 'https://b.com')
    await useTabsStore.getState().navigate(id, 'https://c.com')

    await useTabsStore.getState().goBack(id)

    expect(ipc.ipcTabGoBack).toHaveBeenCalledTimes(1)
    expect(ipc.ipcTabGoBack).toHaveBeenCalledWith(id)
    expect(useTabsStore.getState().canGoBack(id)).toBe(true)
    expect(useTabsStore.getState().canGoForward(id)).toBe(true)
  })

  it('goBack is a no-op at the bottom of the stack', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    await useTabsStore.getState().goBack(id)
    expect(ipc.ipcTabGoBack).not.toHaveBeenCalled()
    expect(useTabsStore.getState().canGoBack(id)).toBe(false)
  })

  it('goForward invokes IPC and restores depth', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    await useTabsStore.getState().navigate(id, 'https://b.com')
    await useTabsStore.getState().navigate(id, 'https://c.com')
    await useTabsStore.getState().goBack(id)

    await useTabsStore.getState().goForward(id)

    expect(ipc.ipcTabGoForward).toHaveBeenCalledTimes(1)
    expect(ipc.ipcTabGoForward).toHaveBeenCalledWith(id)
    expect(useTabsStore.getState().canGoForward(id)).toBe(false)
    expect(useTabsStore.getState().canGoBack(id)).toBe(true)
  })

  it('goForward is a no-op when there is nowhere forward to go', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    await useTabsStore.getState().navigate(id, 'https://b.com')
    await useTabsStore.getState().goForward(id)
    expect(ipc.ipcTabGoForward).not.toHaveBeenCalled()
  })

  it('navigate after a back resets the forward history', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    await useTabsStore.getState().navigate(id, 'https://b.com')
    await useTabsStore.getState().navigate(id, 'https://c.com')
    await useTabsStore.getState().goBack(id)
    expect(useTabsStore.getState().canGoForward(id)).toBe(true)

    await useTabsStore.getState().navigate(id, 'https://d.com')
    expect(useTabsStore.getState().canGoForward(id)).toBe(false)
    expect(useTabsStore.getState().canGoBack(id)).toBe(true)
  })

  it('each tab maintains independent history', async () => {
    const a = await useTabsStore.getState().openTab('https://a.com')
    const b = await useTabsStore.getState().openTab('https://b.com')

    await useTabsStore.getState().navigate(a, 'https://a2.com')

    expect(useTabsStore.getState().canGoBack(a)).toBe(true)
    expect(useTabsStore.getState().canGoBack(b)).toBe(false)
  })

  it('closing a tab purges its history entry', async () => {
    const id = await useTabsStore.getState().openTab('https://a.com')
    await useTabsStore.getState().navigate(id, 'https://b.com')
    expect(useTabsStore.getState().history[id]).toBeDefined()
    await useTabsStore.getState().closeTab(id)
    expect(useTabsStore.getState().history[id]).toBeUndefined()
  })
})
