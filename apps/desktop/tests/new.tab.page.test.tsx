import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, within } from '@testing-library/react'

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

import { NewTabPage } from '~/chrome/NewTabPage'
import { useAiStore } from '~/ai/ai.store'
import { useAuthStore } from '~/auth/auth.store'
import { useTabsStore } from '~/state/tabs.store'

beforeEach(() => {
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
})

describe('NewTabPage capability cards', () => {
  it('renders six capability cards', () => {
    const { container } = render(<NewTabPage />)
    const cards = container.querySelectorAll('button')
    expect(cards.length).toBeGreaterThanOrEqual(6)
  })

  it('opens the sidebar and seeds a starter message when a card is clicked', () => {
    const { container } = render(<NewTabPage />)
    const cards = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.includes('Summarize'))
    expect(cards.length).toBeGreaterThan(0)
    fireEvent.click(cards[0]!)

    const state = useAiStore.getState()
    expect(state.sidebarOpen).toBe(true)
    expect(state.activeConversationId).toBeTruthy()
    const convId = state.activeConversationId as string
    const msgs = state.messages[convId] ?? []
    expect(msgs).toHaveLength(1)
    expect(msgs[0]?.role).toBe('assistant')
    expect(msgs[0]?.content).toMatch(/gist/i)
  })

  it('seeds a fresh conversation on every click, even when the sidebar is already open', () => {
    const { container } = render(<NewTabPage />)
    const summarize = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Summarize'))!
    const translate = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Translate'))!

    fireEvent.click(summarize)
    const firstConv = useAiStore.getState().activeConversationId
    expect(firstConv).toBeTruthy()

    fireEvent.click(translate)
    const secondConv = useAiStore.getState().activeConversationId
    expect(secondConv).toBeTruthy()
    expect(secondConv).not.toBe(firstConv)

    const msgs = useAiStore.getState().messages[secondConv as string] ?? []
    expect(msgs[0]?.content).toMatch(/translate/i)
  })

  it('hero wordmark and tagline render', () => {
    const { container } = render(<NewTabPage />)
    expect(container.querySelector('h1')?.textContent).toBe('Baobab')
    expect(within(container).getByText(/grew here/i)).toBeInTheDocument()
  })
})
