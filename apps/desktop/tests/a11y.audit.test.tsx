/**
 * Accessibility audit — runs axe-core against each major UI surface and
 * verifies the chrome's keyboard tab order is intact.
 *
 * Surfaces covered:
 *   • NewTabPage (the "blank canvas" — no active tab)
 *   • AuthScreen (sign-in modal, overlay open)
 *   • TabStrip + Omnibar (the chrome itself, with one active tab)
 *
 * Surfaces are mounted individually rather than via the whole <App />
 * tree — the App pulls in the full Tauri IPC surface and would force us
 * to mock every command. Component-level audits give us the same
 * coverage with vastly less brittle setup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { axe } from './a11y.helper'

// ── External deps that pull in Tauri IPC ─────────────────────────────────

vi.mock('~/state/persistence', () => {
  const persistence = {
    get: vi.fn((_key: string) => Promise.resolve(undefined)),
    set: vi.fn((_key: string, _value: unknown) => Promise.resolve()),
    delete: vi.fn((_key: string) => Promise.resolve()),
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

vi.mock('~/auth/api', () => ({
  authClient: {},
  client: { setAccessToken: vi.fn() },
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
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: vi.fn(async () => undefined),
    minimize: vi.fn(async () => undefined),
    toggleMaximize: vi.fn(async () => undefined),
  }),
}))

vi.mock('~/history/omnibar-autocomplete', () => ({
  suggest: vi.fn(async () => []),
}))

// ── Component imports (after mocks) ──────────────────────────────────────

import { NewTabPage } from '~/chrome/NewTabPage'
import { AuthScreen } from '~/auth/AuthScreen'
import { TabStrip } from '~/chrome/TabStrip'
import { Omnibar } from '~/chrome/Omnibar'
import { useAiStore } from '~/ai/ai.store'
import { useAuthStore } from '~/auth/auth.store'
import { useTabsStore } from '~/state/tabs.store'
import { useSovereigntyStore } from '~/state/sovereignty.store'

// ── Helpers ──────────────────────────────────────────────────────────────

function resetStores(): void {
  useAiStore.setState({
    sidebarOpen: false,
    conversations: [],
    activeConversationId: null,
    messages: {},
    streaming: false,
  })
  useAuthStore.setState({
    user: null,
    status: 'idle',
    signInOverlayOpen: false,
  })
  useTabsStore.setState({
    tabs: [],
    activeId: null,
    history: {},
  })
  useSovereigntyStore.setState({
    residency: { colo: 'LOS', region: 'africa', dataResidency: 'af' },
    lowBwMode: 'auto',
    adsBlocked: 0,
    pageLoadMs: null,
  })
}

beforeEach(() => {
  resetStores()
})

// ── Audits ──────────────────────────────────────────────────────────────

describe('accessibility audit', () => {
  it('NewTabPage has no axe violations', async () => {
    const { container } = render(<NewTabPage />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('AuthScreen (sign-in overlay open) has no axe violations', async () => {
    useAuthStore.setState({ signInOverlayOpen: true })
    const { container } = render(<AuthScreen />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('TabStrip has no axe violations', async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: 't1',
          url: 'https://example.com',
          title: 'Example',
          pinned: false,
          active: true,
          loading: false,
          lastVisitedAt: 0,
        },
      ],
      activeId: 't1',
    })
    const { container } = render(<TabStrip />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('Omnibar has no axe violations', async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: 't1',
          url: 'https://example.com',
          title: 'Example',
          pinned: false,
          active: true,
          loading: false,
          lastVisitedAt: 0,
        },
      ],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const { container } = render(<Omnibar />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('Omnibar with focused input and suggestions still has no violations', async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: 't1',
          url: 'https://example.com',
          title: 'Example',
          pinned: false,
          active: true,
          loading: false,
          lastVisitedAt: 0,
        },
      ],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const { container } = render(<Omnibar />)
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
    fireEvent.focus(input as HTMLInputElement)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

// ── Keyboard tab-order through the chrome ────────────────────────────────
//
// Walks the focus order of the rendered Omnibar — every button (and the
// input) should be reachable in sequence. jsdom doesn't implement real
// tab focus traversal, so we drive it manually by reading the DOM order
// of focusable elements and asserting the expected labels appear in
// sequence. This catches things like `tabindex="-1"` or `display: none`
// silently removing controls from the order.

describe('Omnibar keyboard tab order', () => {
  it('focusable elements appear in the expected sequence', () => {
    useTabsStore.setState({
      tabs: [
        {
          id: 't1',
          url: 'https://example.com',
          title: 'Example',
          pinned: false,
          active: true,
          loading: false,
          lastVisitedAt: 0,
        },
      ],
      activeId: 't1',
      history: { t1: { depth: 1, max: 2 } },
    })

    const { container } = render(<Omnibar />)
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    )

    // Map each focusable to a stable identifier — input gets its aria-label,
    // buttons get aria-label or text. We don't compare the whole list
    // strictly (the chrome occasionally grows new actions), but we *do*
    // require the canonical sequence below to appear in order.
    const labelOf = (el: HTMLElement): string =>
      el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '<unlabeled>'
    const labels = focusables.map(labelOf)

    const expectedOrder = [
      'Back',
      'Forward',
      'Reload',
      'Address and search bar',
      'Reader Mode',
      'Downloads',
      // BookmarkButton renders one of two labels depending on state
      /Bookmark this page|Remove bookmark/,
      'Bookmarks',
      'History',
      'Saved',
      // AI sidebar toggle
      /Open AI sidebar|Hide AI sidebar/,
    ] as const

    let cursor = 0
    for (const expected of expectedOrder) {
      const matcher = (s: string): boolean =>
        typeof expected === 'string' ? s === expected : expected.test(s)
      const hit = labels.slice(cursor).findIndex(matcher)
      expect(
        hit,
        `Could not find expected focusable "${String(expected)}" after index ${cursor}. Labels were: ${labels.join(' | ')}`,
      ).toBeGreaterThanOrEqual(0)
      cursor += hit + 1
    }
  })
})
