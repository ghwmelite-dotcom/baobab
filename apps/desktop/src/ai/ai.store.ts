import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  createdAt?: number
}

export interface Conversation {
  id: string
  title: string
  updatedAt: number
}

interface AiState {
  sidebarOpen: boolean
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, ChatMessage[]>
  streaming: boolean
  toggleSidebar: () => void
  setActive: (id: string | null) => void
  appendToken: (convId: string, msgId: string, token: string) => void
  pushMessage: (convId: string, msg: ChatMessage) => void
  setConversations: (cs: Conversation[]) => void
  setStreaming: (s: boolean) => void
}

export const useAiStore = create<AiState>()((set) => ({
  sidebarOpen: false,
  conversations: [],
  activeConversationId: null,
  messages: {},
  streaming: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActive: (id) => set({ activeConversationId: id }),

  appendToken: (convId, msgId, token) =>
    set((s) => {
      const list = s.messages[convId]
      if (!list) return s
      const updated = list.map((m) => (m.id === msgId ? { ...m, content: m.content + token } : m))
      return { messages: { ...s.messages, [convId]: updated } }
    }),

  pushMessage: (convId, msg) =>
    set((s) => {
      const list = s.messages[convId] ?? []
      return { messages: { ...s.messages, [convId]: [...list, msg] } }
    }),

  setConversations: (cs) => set({ conversations: cs }),
  setStreaming: (streaming) => set({ streaming }),
}))
