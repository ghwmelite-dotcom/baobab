import { useTranslation } from 'react-i18next'
import { useAiStore, type AgentId } from './ai.store'

const AGENT_IDS: ReadonlyArray<AgentId> = ['default', 'bureaucracy']

const LABEL_KEY: Record<AgentId, string> = {
  default: 'chat.agentSelector.default',
  bureaucracy: 'chat.agentSelector.bureaucracy',
}

// Pill-style toggle modeled on AuthScreen's phone/email tabs — pill border,
// accent fill when active. The selector lives between the ChatPanel title
// and the QuickActions row so the user can see they're talking to a vertical
// agent before they type.
export function AgentSelector() {
  const { t } = useTranslation()
  const activeAgent = useAiStore((s) => s.activeAgent)
  const setAgent = useAiStore((s) => s.setAgent)

  return (
    <div
      role="tablist"
      aria-label={t('chat.agentSelector.ariaLabel')}
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 3,
        margin: '4px 8px 0',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        alignSelf: 'flex-start',
        width: 'auto',
      }}
    >
      {AGENT_IDS.map((id) => {
        const selected = activeAgent === id
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => setAgent(id)}
            style={{
              padding: '4px 12px',
              minHeight: 26,
              borderRadius: 999,
              background: selected ? 'var(--accent)' : 'transparent',
              color: selected ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 11.5,
              transition: 'background 140ms ease, color 140ms ease',
            }}
          >
            {t(LABEL_KEY[id])}
          </button>
        )
      })}
    </div>
  )
}
