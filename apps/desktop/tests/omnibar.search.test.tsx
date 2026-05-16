import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Tauri mocks ──────────────────────────────────────────────────────────

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'profile-test' }),
}))

// Prevent @tauri-apps/plugin-store from exploding in jsdom.
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

// ── Tabs store mock — controllable navigate / openTab / activeId / tabs ──

const navigateMock = vi.fn()
const openTabMock = vi.fn()
const stateMock = {
  activeId: 'tab-1' as string | null,
  tabs: [{ id: 'tab-1', url: 'about:blank' }] as Array<{ id: string; url: string }>,
  navigate: navigateMock,
  openTab: openTabMock,
  goBack: vi.fn(),
  goForward: vi.fn(),
  history: {} as Record<string, { depth: number; max: number }>,
}

vi.mock('~/state/tabs.store', () => ({
  useTabsStore: Object.assign(
    (selector: (s: typeof stateMock) => unknown) => selector(stateMock),
    {
      getState: () => stateMock,
      setState: (patch: Partial<typeof stateMock>) => { Object.assign(stateMock, patch) },
    },
  ),
}))

// ── Import component after mocks ─────────────────────────────────────────

import { Omnibar } from '~/chrome/Omnibar'

beforeEach(() => {
  invokeMock.mockReset()
  navigateMock.mockReset()
  openTabMock.mockReset()
  stateMock.activeId = 'tab-1'
  stateMock.tabs = [{ id: 'tab-1', url: 'about:blank' }]
  stateMock.history = {}
})

// In the test (Vitest) environment, `import.meta.env.DEV` is true, so the
// Omnibar's SEARCH_BASE_URL resolves to the http://localhost:1420 form.
const EXPECTED_SEARCH_BASE = 'http://localhost:1420/search.html'

describe('Omnibar search routing', () => {
  it('typing a search query and pressing Enter navigates to the search page', () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'baobab tree facts' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith(
      'tab-1',
      `${EXPECTED_SEARCH_BASE}?q=baobab%20tree%20facts`,
    )
  })

  it('typing a hostname-with-dot still navigates as URL, not search', () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'example.com' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigateMock).toHaveBeenCalledWith('tab-1', 'https://example.com')
  })

  it('omnibar value displays the decoded query when current tab is on a tauri-scheme search page', () => {
    stateMock.tabs = [{ id: 'tab-1', url: 'tauri://localhost/search.html?q=baobab%20tree' }]
    render(<Omnibar />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('baobab tree')
  })

  it('omnibar value displays the decoded query when current tab is on a http-localhost search page', () => {
    stateMock.tabs = [{ id: 'tab-1', url: 'http://localhost:1420/search.html?q=baobab%20tree' }]
    render(<Omnibar />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('baobab tree')
  })
})
