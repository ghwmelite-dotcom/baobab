import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('~/state/persistence', () => ({
  persistence: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
}))

vi.mock('~/auth/api', () => ({
  authClient: {},
  client: { setAccessToken: vi.fn() },
}))

import i18n from '~/i18n'
import { NewTabPage } from '~/chrome/NewTabPage'
import { useAiStore } from '~/ai/ai.store'
import { useAuthStore } from '~/auth/auth.store'
import { useTabsStore } from '~/state/tabs.store'

beforeEach(async () => {
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
  useTabsStore.setState({ tabs: [], activeId: null })
  await i18n.changeLanguage('en')
})

describe('i18n framework', () => {
  it('NewTabPage renders English copy when language is "en"', () => {
    const { container } = render(<NewTabPage />)
    // Wordmark
    expect(container.querySelector('h1')?.textContent).toBe('Baobab')
    // Tagline accent ("grew here.") is rendered via the <Trans /> component
    expect(container.textContent).toMatch(/grew here/i)
    // Capability cards
    expect(container.textContent).toMatch(/Summarize/)
    expect(container.textContent).toMatch(/Give me the gist/)
    expect(container.textContent).toMatch(/Translate/)
    expect(container.textContent).toMatch(/Explain Code/)
  })

  it('falls back to English copy when language is a stub locale (yo)', async () => {
    await i18n.changeLanguage('yo')
    const { container } = render(<NewTabPage />)
    // Stub locale keys only contain _meta; everything else resolves to English via fallbackLng.
    expect(container.querySelector('h1')?.textContent).toBe('Baobab')
    expect(container.textContent).toMatch(/grew here/i)
    expect(container.textContent).toMatch(/Summarize/)
  })

  it('falls back to English copy when language is sw (stub)', async () => {
    await i18n.changeLanguage('sw')
    const { container } = render(<NewTabPage />)
    expect(container.textContent).toMatch(/Summarize/)
    expect(container.textContent).toMatch(/Translate/)
  })

  it('falls back to English copy when language is ha (stub)', async () => {
    await i18n.changeLanguage('ha')
    const { container } = render(<NewTabPage />)
    expect(container.textContent).toMatch(/Summarize/)
  })

  it('falls back to English when changing to an unknown language code', async () => {
    // i18next will treat an unsupported lng as needing fallback to en.
    await i18n.changeLanguage('xx-unknown')
    const { container } = render(<NewTabPage />)
    expect(container.querySelector('h1')?.textContent).toBe('Baobab')
    expect(container.textContent).toMatch(/Summarize/)
  })

  it('exposes the time-aware greeting in English', () => {
    const { container } = render(<NewTabPage />)
    // One of the five greeting strings should appear.
    const txt = container.textContent ?? ''
    const anyGreeting =
      /Late night reading/.test(txt) ||
      /Good morning/.test(txt) ||
      /Good afternoon/.test(txt) ||
      /Good evening/.test(txt) ||
      /Reading by lamplight/.test(txt)
    expect(anyGreeting).toBe(true)
  })
})
