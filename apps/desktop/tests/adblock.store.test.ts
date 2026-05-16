import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  setEnabled: vi.fn(),
  refreshLists: vi.fn(),
}))

vi.mock('~/adblock/adblock.api', () => ({
  adblockApi: apiMocks,
}))

import { useAdblockStore } from '~/adblock/adblock.store'

beforeEach(() => {
  apiMocks.getState.mockReset()
  apiMocks.setEnabled.mockReset()
  apiMocks.refreshLists.mockReset()
  useAdblockStore.setState({
    enabled: true,
    lastUpdated: '',
    source: { kind: 'Bundled' },
    refreshing: false,
    error: null,
    lastRefreshAttempt: 0,
  })
})

describe('useAdblockStore', () => {
  it('hydrate calls getState and updates store', async () => {
    apiMocks.getState.mockResolvedValue({
      enabled: false,
      lastUpdated: '2026-05-16T00:00:00Z',
      source: { kind: 'Upstream', fetchedAt: '2026-05-16T00:00:00Z' },
    })
    await useAdblockStore.getState().hydrate('p1')
    const s = useAdblockStore.getState()
    expect(s.enabled).toBe(false)
    expect(s.lastUpdated).toBe('2026-05-16T00:00:00Z')
  })

  it('setEnabled persists and updates store', async () => {
    apiMocks.setEnabled.mockResolvedValue(undefined)
    await useAdblockStore.getState().setEnabled('p1', false)
    expect(apiMocks.setEnabled).toHaveBeenCalledWith('p1', false)
    expect(useAdblockStore.getState().enabled).toBe(false)
  })

  it('refresh updates lastUpdated and source', async () => {
    apiMocks.refreshLists.mockResolvedValue({
      enabled: true,
      lastUpdated: '2026-05-16T10:00:00Z',
      source: { kind: 'Upstream', fetchedAt: '2026-05-16T10:00:00Z' },
    })
    await useAdblockStore.getState().refresh()
    const s = useAdblockStore.getState()
    expect(s.lastUpdated).toBe('2026-05-16T10:00:00Z')
    expect(s.source).toEqual({ kind: 'Upstream', fetchedAt: '2026-05-16T10:00:00Z' })
    expect(s.refreshing).toBe(false)
  })

  it('refresh enforces 60s cooldown', async () => {
    apiMocks.refreshLists.mockResolvedValue({ enabled: true, lastUpdated: 'x', source: { kind: 'Bundled' } })
    await useAdblockStore.getState().refresh()
    apiMocks.refreshLists.mockClear()

    // Second call within 60s should be a no-op
    await useAdblockStore.getState().refresh()
    expect(apiMocks.refreshLists).not.toHaveBeenCalled()
  })

  it('refresh surfaces error and clears refreshing flag', async () => {
    apiMocks.refreshLists.mockRejectedValue('network failure')
    await useAdblockStore.getState().refresh()
    const s = useAdblockStore.getState()
    expect(s.error).toBe('network failure')
    expect(s.refreshing).toBe(false)
  })
})
