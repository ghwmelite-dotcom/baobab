import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  streamChat: vi.fn(),
}))

vi.mock('~/ai/api', () => ({
  aiClient: { streamChat: mocks.streamChat },
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
  })
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.com', phone: null, privacy_mode: 0, low_bandwidth_mode: 0, default_model: 'm' },
    status: 'authed',
    signInOverlayOpen: false,
  })
  mocks.streamChat.mockReset()
  mocks.streamChat.mockImplementation(async function* () {
    yield { token: 'Hel' }
    yield { token: 'lo' }
    yield { token: '!' }
  })
})

describe('ChatPanel', () => {
  it('streams tokens into the assistant bubble', async () => {
    render(<ChatPanel />)
    fireEvent.change(screen.getByLabelText(/chat input/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await waitFor(() => expect(screen.getByText('Hello!')).toBeInTheDocument())
  })
})
