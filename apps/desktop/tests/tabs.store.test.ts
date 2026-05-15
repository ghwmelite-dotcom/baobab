import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => undefined),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
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
  useTabsStore.setState({ tabs: [], activeId: null })
  useTabsStore.getState().setProfileId('test-profile')
  vi.clearAllMocks()
})

describe('tabs store', () => {
  it('opens a new tab and marks it active', async () => {
    await useTabsStore.getState().openTab('https://example.com')
    const { tabs, activeId } = useTabsStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.url).toBe('https://example.com')
    expect(activeId).toBe(tabs[0]?.id)
    expect(ipc.ipcCreateTab).toHaveBeenCalledOnce()
  })

  it('appends new tabs at the end of the strip', async () => {
    const a = await useTabsStore.getState().openTab('https://a.com')
    const b = await useTabsStore.getState().openTab('https://b.com')
    useTabsStore.getState().setActive(a)
    // Even with `a` active, the new tab `c` lands at the end (after b),
    // not next to a. Firefox-style behaviour, by user preference.
    const c = await useTabsStore.getState().openTab('https://c.com')
    const ids = useTabsStore.getState().tabs.map((t) => t.id)
    expect(ids).toEqual([a, b, c])
  })

  it('closes tabs and falls back to neighbor as active', async () => {
    const a = await useTabsStore.getState().openTab('https://a.com')
    const b = await useTabsStore.getState().openTab('https://b.com')
    await useTabsStore.getState().closeTab(b)
    const { tabs, activeId } = useTabsStore.getState()
    expect(tabs).toHaveLength(1)
    expect(activeId).toBe(a)
  })

  it('reorder moves a tab to a new index', async () => {
    const a = await useTabsStore.getState().openTab('https://a.com')
    const b = await useTabsStore.getState().openTab('https://b.com')
    const c = await useTabsStore.getState().openTab('https://c.com')
    useTabsStore.getState().reorderTab(a, 2)
    expect(useTabsStore.getState().tabs.map((t) => t.id)).toEqual([b, c, a])
  })

  it('toggling pin moves the tab to the front of the list', async () => {
    const a = await useTabsStore.getState().openTab('https://a.com')
    const b = await useTabsStore.getState().openTab('https://b.com')
    useTabsStore.getState().togglePin(b)
    expect(useTabsStore.getState().tabs[0]?.id).toBe(b)
    expect(useTabsStore.getState().tabs[0]?.pinned).toBe(true)
  })
})
