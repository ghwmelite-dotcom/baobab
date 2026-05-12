import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  summarize: vi.fn(async () => ({ summary: 'OK', key_points: ['x'], est_read_time: 1, cached: false })),
}))

vi.mock('~/ai/api', () => ({
  aiClient: { summarize: mocks.summarize },
}))

import { QuickActions } from '~/ai/QuickActions'
import { useTabsStore } from '~/state/tabs.store'
import { useAiStore } from '~/ai/ai.store'

beforeEach(() => {
  useTabsStore.setState({
    tabs: [{ id: 't1', url: 'https://example.com', title: 'X', pinned: false, active: true, loading: false, lastVisitedAt: 0 }],
    activeId: 't1',
  })
  useAiStore.setState({ sidebarOpen: true, conversations: [], activeConversationId: null, messages: {}, streaming: false })
  mocks.summarize.mockClear()
})

describe('QuickActions', () => {
  it('Summarize calls aiClient.summarize with active tab url', async () => {
    render(<QuickActions />)
    fireEvent.click(screen.getByRole('button', { name: /summarize/i }))
    await waitFor(() => expect(mocks.summarize).toHaveBeenCalledWith({ url: 'https://example.com' }))
  })
})
