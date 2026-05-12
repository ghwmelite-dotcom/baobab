import { useEffect, useRef, useState } from 'react'
import { useAiStore } from './ai.store'
import { aiClient } from './api'
import { MessageBubble } from './MessageBubble'
import { ModelSelector } from './ModelSelector'
import { Button, Input } from '@baobab/ui'
import { strings } from '@baobab/brand'

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function ChatPanel() {
  const [input, setInput] = useState('')
  const [model, setModel] = useState<string | undefined>()
  const activeId = useAiStore((s) => s.activeConversationId)
  const setActive = useAiStore((s) => s.setActive)
  const pushMessage = useAiStore((s) => s.pushMessage)
  const appendToken = useAiStore((s) => s.appendToken)
  const setStreaming = useAiStore((s) => s.setStreaming)
  const streaming = useAiStore((s) => s.streaming)
  const messages = useAiStore((s) => (activeId ? (s.messages[activeId] ?? []) : []))
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    if (!input.trim() || streaming) return
    const userContent = input.trim()
    const userMsg = { id: newMsgId(), role: 'user' as const, content: userContent }
    const convId = activeId ?? `c${Date.now().toString(36)}`
    if (!activeId) setActive(convId)
    pushMessage(convId, userMsg)

    const asstId = newMsgId()
    pushMessage(convId, { id: asstId, role: 'assistant', content: '', model })
    setInput('')
    setStreaming(true)
    try {
      for await (const { token } of aiClient.streamChat({
        message: userContent,
        model_id: model,
        conversation_id: activeId ?? undefined,
      })) {
        appendToken(convId, asstId, token)
      }
    } catch (e) {
      appendToken(convId, asstId, `\n\n[error: ${e instanceof Error ? e.message : 'unknown'}]`)
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <strong style={{ fontSize: 13 }}>Baobab AI</strong>
        <ModelSelector value={model} onChange={setModel} />
      </header>
      <div style={{ flex: 1, overflow: 'auto', paddingBlock: 8 }}>
        {messages.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            {strings.loading.aiThinking.replace('…', '')} — say hi.
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>
      <footer style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="Ask anything…"
          disabled={streaming}
          aria-label="Chat input"
        />
        <Button onClick={() => void send()} loading={streaming} disabled={!input.trim() || streaming}>
          Send
        </Button>
      </footer>
    </div>
  )
}
