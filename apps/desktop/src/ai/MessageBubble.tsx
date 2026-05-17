import type { ChatMessage } from './ai.store'

interface Props {
  message: ChatMessage
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', padding: '6px 12px' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 12px',
          borderRadius: 12,
          background: isUser ? 'var(--accent)' : 'var(--surface-2)',
          color: isUser ? 'var(--text-on-accent)' : 'var(--text-primary)',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        {message.model && !isUser && (
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>{message.model}</div>
        )}
      </div>
    </div>
  )
}
