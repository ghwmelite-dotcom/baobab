import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { useConnectionStore } from '~/state/connection.store'
import { useTabsStore } from '~/state/tabs.store'
import { __resetInterceptOverridesForTest } from '~/reader/intercept'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => ({ id: 't2', url: 'about:blank' })),
  ipcCloseTab: vi.fn(),
  ipcShowTab: vi.fn(),
  ipcHideTab: vi.fn(),
  ipcNavigateTab: vi.fn(),
  ipcListTabs: vi.fn(async () => []),
  ipcTabGoBack: vi.fn(), ipcTabGoForward: vi.fn(),
  ipcTabReload: vi.fn(),
  onTabLoaded: () => () => {},
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ close: vi.fn(), minimize: vi.fn(), toggleMaximize: vi.fn(), startDragging: vi.fn() }),
}))
// The native context menu in TabStrip routes through this module — mock it so
// the test can fire a "duplicate" selection synchronously.
let nextMenuResolve: ((id: string | null) => void) | null = null
vi.mock('~/ipc/menus', () => ({
  showContextMenu: vi.fn(() => new Promise<string | null>((r) => { nextMenuResolve = r })),
}))

import { TabStrip } from '~/chrome/TabStrip'

const tabAt = (url: string) => ({
  id: 't1', url, title: 'A', pinned: false, active: true, loading: false, lastVisitedAt: 0,
})

beforeEach(() => {
  vi.clearAllMocks()
  __resetInterceptOverridesForTest()
  nextMenuResolve = null
  useConnectionStore.setState({
    effectiveType: '2g', type: 'cellular', isOffline: false, isSlow: true,
    slowModeForced: false, downlinkMbps: 0, saveData: false,
  })
})

describe('TabStrip duplicate gating', () => {
  it('opens countdown when duplicating a heavy URL on slow', async () => {
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')
    const openTabAfter = vi.spyOn(useTabsStore.getState(), 'openTabAfter')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')

    await waitFor(() => expect(screen.getByRole('dialog', { name: /heavy page/i })).toBeInTheDocument())
    expect(duplicateTab).not.toHaveBeenCalled()
    expect(openTabAfter).not.toHaveBeenCalled()
  })

  it('on accept, opens a new tab pointing at reader.html?url=…', async () => {
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const openTabAfter = vi.spyOn(useTabsStore.getState(), 'openTabAfter')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /open now/i }))

    await waitFor(() => expect(openTabAfter).toHaveBeenCalled())
    const args = openTabAfter.mock.calls[0]!
    expect(args[0]).toBe('t1')
    expect(args[1]).toContain('/reader.html?url=')
    expect(args[1]).toContain(encodeURIComponent('https://example.com/article'))
  })

  it('on cancel, falls back to a normal duplicateTab', async () => {
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => expect(duplicateTab).toHaveBeenCalledWith('t1'))
  })

  it('on wifi, no countdown — duplicateTab called directly', async () => {
    useConnectionStore.setState({ effectiveType: '4g', type: 'wifi', isSlow: false })
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')

    await waitFor(() => expect(duplicateTab).toHaveBeenCalledWith('t1'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('skips countdown when duplicating an already-reader-mode tab', async () => {
    useTabsStore.setState({
      tabs: [tabAt('tauri://localhost/reader.html?url=' + encodeURIComponent('https://example.com/x'))],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')

    // The URL is tauri://localhost/reader.html?... — not http(s), so shouldIntercept returns false.
    await waitFor(() => expect(duplicateTab).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
