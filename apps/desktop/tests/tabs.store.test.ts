import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => undefined),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
}))

import { useTabsStore } from '~/state/tabs.store'
import * as ipc from '~/ipc/tabs'

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeId: null })
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

  it('inserts new tab to right of active tab', async () => {
    const a = await useTabsStore.getState().openTab('https://a.com')
    const b = await useTabsStore.getState().openTab('https://b.com')
    useTabsStore.getState().setActive(a)
    const c = await useTabsStore.getState().openTab('https://c.com')
    const ids = useTabsStore.getState().tabs.map((t) => t.id)
    expect(ids).toEqual([a, c, b])
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
