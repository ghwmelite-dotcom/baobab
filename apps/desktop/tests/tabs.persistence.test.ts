import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Tab } from '@baobab/core'

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

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => undefined),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
}))

import { useTabsStore } from '~/state/tabs.store'
import { persistence } from '~/state/persistence'

interface TabsSnapshot {
  tabs: Tab[]
  activeId: string | null
}

const PROFILE_ID = 'test-profile'
const SNAPSHOT_KEY = `profile.${PROFILE_ID}.tabs.snapshot`

async function flushDebounce(): Promise<void> {
  await new Promise((r) => setTimeout(r, 350))
}

beforeEach(() => {
  store.clear()
  useTabsStore.setState({ tabs: [], activeId: null })
  useTabsStore.getState().setProfileId(PROFILE_ID)
  vi.clearAllMocks()
})

describe('tabs persistence', () => {
  it('persists open tabs and active id after debounce', async () => {
    await useTabsStore.getState().hydrate() // installs subscriber

    const a = await useTabsStore.getState().openTab('https://a.com')
    const b = await useTabsStore.getState().openTab('https://b.com')

    await flushDebounce()

    const snap = store.get(SNAPSHOT_KEY) as TabsSnapshot | undefined
    expect(snap).toBeDefined()
    expect(snap?.tabs.map((t) => t.url)).toEqual(['https://a.com', 'https://b.com'])
    expect([a, b]).toContain(snap?.activeId)
    expect(snap?.activeId).toBe(b)
  })

  it('hydrate() restores tabs from the snapshot', async () => {
    const saved: TabsSnapshot = {
      tabs: [
        {
          id: 'old-1',
          url: 'https://restored-1.com',
          title: 'Restored 1',
          pinned: false,
          active: false,
          loading: false,
          lastVisitedAt: 1000,
        },
        {
          id: 'old-2',
          url: 'https://restored-2.com',
          title: 'Restored 2',
          pinned: true,
          active: true,
          loading: false,
          lastVisitedAt: 2000,
        },
      ],
      activeId: 'old-2',
    }
    await persistence.set(SNAPSHOT_KEY, saved)

    // Fresh store state
    useTabsStore.setState({ tabs: [], activeId: null })

    await useTabsStore.getState().hydrate()

    const state = useTabsStore.getState()
    expect(state.tabs).toHaveLength(2)
    const urls = state.tabs.map((t) => t.url)
    expect(urls).toContain('https://restored-1.com')
    expect(urls).toContain('https://restored-2.com')
    const activeUrl = state.tabs.find((t) => t.id === state.activeId)?.url
    expect(activeUrl).toBe('https://restored-2.com')

    const restored2 = state.tabs.find((t) => t.url === 'https://restored-2.com')
    expect(restored2?.pinned).toBe(true)
    expect(restored2?.title).toBe('Restored 2')
  })

  it('excludes incognito tabs from the snapshot', async () => {
    await useTabsStore.getState().hydrate()

    await useTabsStore.getState().openTab('https://normal.com')
    await useTabsStore.getState().openTab('https://incognito.com')

    // Mark the second tab as incognito (Phase B will add this field; we
    // simulate it here to confirm the persistence filter behaves).
    useTabsStore.setState((s) => ({
      tabs: s.tabs.map((t, i) =>
        i === 1 ? ({ ...t, incognito: true } as Tab & { incognito: boolean }) : t,
      ),
    }))

    await flushDebounce()

    const snap = store.get(SNAPSHOT_KEY) as TabsSnapshot | undefined
    expect(snap).toBeDefined()
    expect(snap?.tabs).toHaveLength(1)
    expect(snap?.tabs[0]?.url).toBe('https://normal.com')
  })
})
