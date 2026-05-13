import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ── Tauri / IPC mocks ────────────────────────────────────────────────────

vi.mock('~/state/persistence', () => ({
  persistence: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
}))

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => ({ id: 't1', url: 'about:blank' })),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcHideTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
  ipcListTabs: vi.fn(async () => []),
  ipcTabGoBack: vi.fn(async () => undefined),
  ipcTabGoForward: vi.fn(async () => undefined),
  onTabLoaded: vi.fn(async () => () => undefined),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: vi.fn(async () => undefined),
    minimize: vi.fn(async () => undefined),
    toggleMaximize: vi.fn(async () => undefined),
  }),
}))

// ── Component imports (after mocks) ──────────────────────────────────────

import { TabStrip } from '~/chrome/TabStrip'
import { useTabsStore } from '~/state/tabs.store'
import { useSovereigntyStore } from '~/state/sovereignty.store'

beforeEach(() => {
  useTabsStore.setState({ tabs: [], activeId: null, history: {} })
  useSovereigntyStore.setState({
    residency: { colo: 'LOS', region: 'africa', dataResidency: 'af' },
    lowBwMode: 'auto',
    adsBlocked: 0,
    pageLoadMs: null,
  })
})

describe('TabPill favicon + title', () => {
  it('renders the favicon image and page title for a real URL', () => {
    useTabsStore.setState({
      tabs: [
        {
          id: 't1',
          url: 'https://example.com',
          title: 'Example',
          faviconUrl: 'https://www.google.com/s2/favicons?domain=example.com&sz=32',
          pinned: false,
          active: true,
          loading: false,
          lastVisitedAt: 0,
        },
      ],
      activeId: 't1',
    })

    const { container } = render(<TabStrip />)
    const img = container.querySelector('img[src*="example.com"]') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toContain('example.com')
    expect(img?.getAttribute('alt')).toBe('')
    expect(img?.getAttribute('loading')).toBe('lazy')
    expect(screen.getByText('Example')).toBeInTheDocument()
  })

  it('does not render a favicon for about:blank', () => {
    useTabsStore.setState({
      tabs: [
        {
          id: 't1',
          url: 'about:blank',
          title: '',
          pinned: false,
          active: true,
          loading: false,
          lastVisitedAt: 0,
        },
      ],
      activeId: 't1',
    })

    const { container } = render(<TabStrip />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('New Tab')).toBeInTheDocument()
  })

  it('omits the favicon if no faviconUrl is set on the tab', () => {
    useTabsStore.setState({
      tabs: [
        {
          id: 't1',
          url: 'https://example.com',
          title: 'Example',
          pinned: false,
          active: true,
          loading: true,
          lastVisitedAt: 0,
        },
      ],
      activeId: 't1',
    })

    const { container } = render(<TabStrip />)
    expect(container.querySelector('img')).toBeNull()
  })
})
