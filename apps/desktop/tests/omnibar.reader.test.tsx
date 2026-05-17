import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { useConnectionStore } from '~/state/connection.store'
import { useTabsStore } from '~/state/tabs.store'
import { __resetInterceptOverridesForTest } from '~/reader/intercept'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => ({ id: 't1', url: 'about:blank' })),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcHideTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
  ipcListTabs: vi.fn(async () => []),
  ipcTabGoBack: vi.fn(async () => undefined),
  ipcTabGoForward: vi.fn(async () => undefined),
  ipcTabReload: vi.fn(async () => undefined),
  onTabLoaded: () => () => {},
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ close: vi.fn(), minimize: vi.fn(), toggleMaximize: vi.fn(), startDragging: vi.fn() }),
}))
vi.mock('~/history/omnibar-autocomplete', () => ({ suggest: vi.fn(async () => []) }))

// Needed because persistence.ts (imported transitively by tabs.store) calls
// @tauri-apps/plugin-store at module init time.
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => ({
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  })),
}))

// Stub auth/api so auth.store doesn't try to construct a live HTTP client.
vi.mock('~/auth/api', () => ({
  authClient: {},
  client: { setAccessToken: vi.fn() },
}))

import { Omnibar } from '~/chrome/Omnibar'
import { ipcNavigateTab } from '~/ipc/tabs'

beforeEach(() => {
  vi.clearAllMocks()
  __resetInterceptOverridesForTest()
  useConnectionStore.setState({
    effectiveType: '2g', type: 'cellular', isOffline: false, isSlow: true,
    slowModeForced: false, downlinkMbps: 0, saveData: false,
  })
  useTabsStore.setState({
    tabs: [{ id: 't1', url: 'about:blank', title: '', pinned: false, active: true, loading: false, lastVisitedAt: 0 }],
    activeId: 't1',
    history: { t1: { depth: 0, max: 0 } },
  })
})

describe('Omnibar Bundle-B integration', () => {
  it('on slow + non-skip URL, opens the countdown before navigating', async () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('dialog', { name: /heavy page/i })).toBeInTheDocument())
    expect(ipcNavigateTab).not.toHaveBeenCalled()
  })

  it('on slow + non-skip URL, accepting countdown navigates to reader.html?url=…', async () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /open now/i }))
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    const calls = (ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1]
    const url = lastCall[1] as string
    expect(url).toContain('/reader.html?url=')
    expect(url).toContain(encodeURIComponent('https://example.com/article'))
  })

  it('on slow + non-skip URL, cancelling the countdown navigates to the original URL', async () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    const calls = (ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[1]).toBe('https://example.com/article')
  })

  it('on wifi, no countdown — navigates directly', async () => {
    useConnectionStore.setState({ effectiveType: '4g', type: 'wifi', isSlow: false })
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    const calls = (ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[1]).toBe('https://example.com/article')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders ReaderPill when active tab url is a reader.html URL', () => {
    useTabsStore.setState({
      tabs: [{
        id: 't1',
        url: 'tauri://localhost/reader.html?url=' + encodeURIComponent('https://example.com/article'),
        title: '', pinned: false, active: true, loading: false, lastVisitedAt: 0,
      }],
      activeId: 't1',
    })
    render(<Omnibar />)
    expect(screen.getByRole('button', { name: /reader/i })).toBeInTheDocument()
  })

  it('clicking the pill navigates to the original URL', async () => {
    useTabsStore.setState({
      tabs: [{
        id: 't1',
        url: 'tauri://localhost/reader.html?url=' + encodeURIComponent('https://example.com/article'),
        title: '', pinned: false, active: true, loading: false, lastVisitedAt: 0,
      }],
      activeId: 't1',
    })
    render(<Omnibar />)
    fireEvent.click(screen.getByRole('button', { name: /reader/i }))
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    const calls = (ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall[1]).toBe('https://example.com/article')
  })
})
