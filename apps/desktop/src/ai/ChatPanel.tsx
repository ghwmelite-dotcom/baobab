import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAiStore } from './ai.store'
import { aiClient } from './api'
import { AgentSelector } from './AgentSelector'
import { MessageBubble } from './MessageBubble'
import { ModelSelector } from './ModelSelector'
import { QuickActions } from './QuickActions'
import { Button, IconButton, Input } from '@baobab/ui'
import { useAuthStore } from '~/auth/auth.store'

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function ChatPanel() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [model, setModel] = useState<string | undefined>()
  const activeId = useAiStore((s) => s.activeConversationId)
  const setActive = useAiStore((s) => s.setActive)
  const pushMessage = useAiStore((s) => s.pushMessage)
  const appendToken = useAiStore((s) => s.appendToken)
  const setStreaming = useAiStore((s) => s.setStreaming)
  const streaming = useAiStore((s) => s.streaming)
  const activeAgent = useAiStore((s) => s.activeAgent)
  const messages = useAiStore((s) => (activeId ? (s.messages[activeId] ?? []) : []))
  const user = useAuthStore((s) => s.user)
  const openSignIn = useAuthStore((s) => s.openSignIn)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    if (!input.trim() || streaming) return
    if (!user) { openSignIn(); return }
    const userContent = input.trim()
    const userMsg = { id: newMsgId(), role: 'user' as const, content: userContent }
    const convId = activeId ?? `c${Date.now().toString(36)}`
    if (!activeId) setActive(convId)
    pushMessage(convId, userMsg)

    setInput('')
    setStreaming(true)

    // Vertical agents respond with a single complete answer (no SSE stream).
    // Mirrors the summarize/search quick action flow: push a single assistant
    // bubble with the full body once the request resolves.
    if (activeAgent === 'bureaucracy') {
      try {
        const { answer } = await aiClient.bureaucracy(userContent)
        pushMessage(convId, { id: newMsgId(), role: 'assistant', content: answer })
      } catch (e) {
        pushMessage(convId, {
          id: newMsgId(),
          role: 'assistant',
          content: t('chat.errorPrefix', { error: e instanceof Error ? e.message : 'unknown' }),
        })
      } finally {
        setStreaming(false)
      }
      return
    }

    // Default mode: streaming chat with token-by-token append.
    const asstId = newMsgId()
    pushMessage(convId, { id: asstId, role: 'assistant', content: '', model })
    try {
      for await (const { token } of aiClient.streamChat({
        message: userContent,
        model_id: model,
        conversation_id: activeId ?? undefined,
      })) {
        appendToken(convId, asstId, token)
      }
    } catch (e) {
      appendToken(convId, asstId, `\n\n${t('chat.errorPrefix', { error: e instanceof Error ? e.message : 'unknown' })}`)
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
          gap: 8,
          padding: '8px 8px 8px 4px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <IconButton
          aria-label={t('chat.collapseLabel')}
          onClick={() => useAiStore.getState().toggleSidebar()}
          style={{ width: 32, height: 32, color: 'var(--text-secondary)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M5 3 L9 7 L5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <strong style={{ fontSize: 13, flex: 1 }}>{t('chat.title')}</strong>
        <ModelSelector value={model} onChange={setModel} />
      </header>
      <AgentSelector />
      {activeAgent === 'bureaucracy' && (
        <p
          style={{
            margin: '6px 12px 0',
            fontSize: 11,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}
        >
          {t('chat.bureaucracyHint')}
        </p>
      )}
      <QuickActions />
      <div style={{ flex: 1, overflow: 'auto', paddingBlock: 8 }}>
        {messages.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
            {t('chat.empty')}
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
          placeholder={t('chat.placeholder')}
          disabled={streaming}
          aria-label={t('chat.ariaInput')}
        />
        <Button onClick={() => void send()} loading={streaming} disabled={!input.trim() || streaming}>
          {t('chat.send')}
        </Button>
      </footer>
    </div>
  )
}
