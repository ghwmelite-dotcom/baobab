import { describe, it, expect, beforeEach } from 'vitest'
import { useAiStore } from '~/ai/ai.store'

beforeEach(() => {
  useAiStore.setState({ sidebarOpen: false, conversations: [], activeConversationId: null, messages: {}, streaming: false })
})

describe('ai store', () => {
  it('toggles sidebar', () => {
    useAiStore.getState().toggleSidebar()
    expect(useAiStore.getState().sidebarOpen).toBe(true)
    useAiStore.getState().toggleSidebar()
    expect(useAiStore.getState().sidebarOpen).toBe(false)
  })
  it('appends a streamed token to an existing message', () => {
    useAiStore.setState({
      activeConversationId: 'c1',
      messages: { c1: [{ id: 'm1', role: 'assistant', content: '', model: 'x' }] },
    })
    useAiStore.getState().appendToken('c1', 'm1', 'Hel')
    useAiStore.getState().appendToken('c1', 'm1', 'lo')
    expect(useAiStore.getState().messages.c1?.[0]?.content).toBe('Hello')
  })
  it('pushMessage appends to the conversation list', () => {
    useAiStore.getState().pushMessage('c1', { id: 'm1', role: 'user', content: 'hi' })
    expect(useAiStore.getState().messages.c1).toHaveLength(1)
  })
})
