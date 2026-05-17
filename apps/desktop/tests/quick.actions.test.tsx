import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  summarize: vi.fn(async () => ({ summary: 'OK', key_points: ['x'], est_read_time: 1, cached: false })),
}))

vi.mock('~/ai/api', () => ({
  aiClient: { summarize: mocks.summarize },
}))

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

import { QuickActions } from '~/ai/QuickActions'
import { useTabsStore } from '~/state/tabs.store'
import { useAiStore } from '~/ai/ai.store'
import { useAuthStore } from '~/auth/auth.store'

beforeEach(() => {
  useTabsStore.setState({
    tabs: [{ id: 't1', url: 'https://example.com', title: 'X', pinned: false, active: true, loading: false, lastVisitedAt: 0 }],
    activeId: 't1',
  })
  useAiStore.setState({ sidebarOpen: true, conversations: [], activeConversationId: null, messages: {}, streaming: false })
  useAuthStore.setState({
    user: { id: 'u', email: 'a@b.com', phone: null, display_name: null, privacy_mode: 0, low_bandwidth_mode: 0, default_model: 'm' },
    status: 'authed',
    signInOverlayOpen: false,
  })
  mocks.summarize.mockClear()
})

describe('QuickActions', () => {
  it('Summarize calls aiClient.summarize with active tab url', async () => {
    render(<QuickActions />)
    fireEvent.click(screen.getByRole('button', { name: /summarize/i }))
    await waitFor(() => expect(mocks.summarize).toHaveBeenCalledWith({ url: 'https://example.com' }))
  })
})
