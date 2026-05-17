import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  streamChat: vi.fn(),
  bureaucracy: vi.fn(),
}))

vi.mock('~/ai/api', () => ({
  aiClient: { streamChat: mocks.streamChat, bureaucracy: mocks.bureaucracy },
}))

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

import { ChatPanel } from '~/ai/ChatPanel'
import { useAiStore } from '~/ai/ai.store'
import { useAuthStore } from '~/auth/auth.store'

beforeEach(() => {
  useAiStore.setState({
    sidebarOpen: true,
    conversations: [],
    activeConversationId: null,
    messages: {},
    streaming: false,
    activeAgent: 'default',
  })
  useAuthStore.setState({
    user: {
      id: 'u',
      email: 'a@b.com',
      phone: null,
      display_name: null,
      privacy_mode: 0,
      low_bandwidth_mode: 0,
      default_model: 'm',
    },
    status: 'authed',
    signInOverlayOpen: false,
  })
  mocks.streamChat.mockReset()
  mocks.bureaucracy.mockReset()
})

describe('AgentSelector + ChatPanel routing', () => {
  it('switches activeAgent when the Bureaucracy chip is clicked', () => {
    render(<ChatPanel />)
    expect(useAiStore.getState().activeAgent).toBe('default')
    fireEvent.click(screen.getByRole('tab', { name: /bureaucracy/i }))
    expect(useAiStore.getState().activeAgent).toBe('bureaucracy')
  })

  it('routes messages to aiClient.bureaucracy when the Bureaucracy agent is active', async () => {
    mocks.bureaucracy.mockResolvedValue({ answer: 'Step 1: Reserve a name at RGD…' })

    render(<ChatPanel />)
    fireEvent.click(screen.getByRole('tab', { name: /bureaucracy/i }))

    fireEvent.change(screen.getByLabelText(/chat input/i), {
      target: { value: 'How do I register a business in Ghana?' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() =>
      expect(mocks.bureaucracy).toHaveBeenCalledWith('How do I register a business in Ghana?'),
    )
    await waitFor(() =>
      expect(screen.getByText('Step 1: Reserve a name at RGD…')).toBeInTheDocument(),
    )
    expect(mocks.streamChat).not.toHaveBeenCalled()
  })
})
