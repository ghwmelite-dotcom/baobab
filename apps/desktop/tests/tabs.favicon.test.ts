import { describe, it, expect, vi, beforeEach } from 'vitest'

const { hoisted } = vi.hoisted(() => ({
  hoisted: {
    listeners: [] as Array<(p: { id: string; url: string; title: string | null }) => void>,
  },
}))

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => undefined),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
  ipcTabGoBack: vi.fn(async () => undefined),
  ipcTabGoForward: vi.fn(async () => undefined),
  onTabLoaded: vi.fn(
    async (cb: (p: { id: string; url: string; title: string | null }) => void) => {
      hoisted.listeners.push(cb)
      return () => undefined
    },
  ),
  onTabTitle: vi.fn(async () => () => undefined),
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

import { useTabsStore, faviconForUrl } from '~/state/tabs.store'
import * as ipc from '~/ipc/tabs'

function emitLoaded(payload: { id: string; url: string; title: string | null }): void {
  for (const cb of hoisted.listeners) cb(payload)
}

beforeEach(() => {
  hoisted.listeners.length = 0
  useTabsStore.setState({ tabs: [], activeId: null, history: {}, tabLoadedListening: false })
  useTabsStore.getState().setProfileId('test-profile')
  vi.clearAllMocks()
})

describe('tabs favicon + title', () => {
  it('derives a favicon URL containing the host', () => {
    const url = faviconForUrl('https://example.com/some/path?q=1')
    expect(url).toBeDefined()
    expect(url).toContain('example.com')
    expect(url).toMatch(/sz=32/)
  })

  it('returns undefined for opaque schemes', () => {
    expect(faviconForUrl('about:blank')).toBeUndefined()
    expect(faviconForUrl('data:text/html,hi')).toBeUndefined()
    expect(faviconForUrl('not a url')).toBeUndefined()
  })

  it('initListeners subscribes once (idempotent)', async () => {
    await useTabsStore.getState().initListeners()
    await useTabsStore.getState().initListeners()
    expect(ipc.onTabLoaded).toHaveBeenCalledTimes(1)
  })

  it('handleTabLoaded updates title + faviconUrl for the matching tab', async () => {
    await useTabsStore.getState().initListeners()
    const id = await useTabsStore.getState().openTab('https://example.com')

    emitLoaded({ id, url: 'https://example.com/foo', title: 'Example Domain' })

    const tab = useTabsStore.getState().tabs.find((t) => t.id === id)
    expect(tab?.title).toBe('Example Domain')
    expect(tab?.faviconUrl).toBeDefined()
    expect(tab?.faviconUrl).toContain('example.com')
    expect(tab?.url).toBe('https://example.com/foo')
    expect(tab?.loading).toBe(false)
  })

  it('preserves existing title when payload title is null or empty', async () => {
    await useTabsStore.getState().initListeners()
    const id = await useTabsStore.getState().openTab('https://example.com')
    useTabsStore.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, title: 'Cached Title' } : t)),
    }))

    emitLoaded({ id, url: 'https://example.com/foo', title: null })
    expect(useTabsStore.getState().tabs.find((t) => t.id === id)?.title).toBe('Cached Title')

    emitLoaded({ id, url: 'https://example.com/foo', title: '   ' })
    expect(useTabsStore.getState().tabs.find((t) => t.id === id)?.title).toBe('Cached Title')
  })

  it('does not set faviconUrl for about:blank navigations', async () => {
    await useTabsStore.getState().initListeners()
    const id = await useTabsStore.getState().openTab('about:blank')

    emitLoaded({ id, url: 'about:blank', title: 'New Tab' })

    const tab = useTabsStore.getState().tabs.find((t) => t.id === id)
    expect(tab?.faviconUrl).toBeUndefined()
  })

  it('ignores events for unknown tab ids', async () => {
    await useTabsStore.getState().initListeners()
    await useTabsStore.getState().openTab('https://example.com')
    const before = useTabsStore.getState().tabs

    emitLoaded({ id: 'no-such-tab', url: 'https://x.com', title: 'X' })

    expect(useTabsStore.getState().tabs).toEqual(before)
  })
})
