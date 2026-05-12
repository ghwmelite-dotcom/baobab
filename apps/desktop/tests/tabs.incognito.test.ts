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

import { useTabsStore } from '~/state/tabs.store'
import * as ipc from '~/ipc/tabs'

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeId: null, history: {} })
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
