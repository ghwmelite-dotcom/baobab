import { useTabsStore } from '~/state/tabs.store'
import { aiClient } from './api'
import { useAiStore } from './ai.store'
import { strings } from '@baobab/brand'
import { useAuthStore } from '~/auth/auth.store'

const ACTIONS = [
  { id: 'summarize', label: 'Summarize' },
  { id: 'translate', label: 'Translate' },
  { id: 'extract',   label: 'Extract' },
  { id: 'compare',   label: 'Compare' },
  { id: 'explain',   label: 'Explain Code' },
] as const

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function QuickActions() {
  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const activeTab = tabs.find((t) => t.id === activeId)
  const setActive = useAiStore((s) => s.setActive)
  const pushMessage = useAiStore((s) => s.pushMessage)
  const user = useAuthStore((s) => s.user)
  const openSignIn = useAuthStore((s) => s.openSignIn)

  const runSummarize = async () => {
    if (!activeTab?.url || activeTab.url === 'about:blank') return
    if (!user) { openSignIn(); return }
    const convId = `c${Date.now().toString(36)}`
    setActive(convId)
    pushMessage(convId, { id: newMsgId(), role: 'user', content: `Summarize ${activeTab.url}` })
    pushMessage(convId, { id: newMsgId(), role: 'assistant', content: strings.loading.summarizing })
    try {
      const r = await aiClient.summarize({ url: activeTab.url })
      const out = `${r.summary}\n\nKey points:\n${r.key_points.map((p) => `• ${p}`).join('\n')}\n\nEst. read time: ${r.est_read_time} min${r.cached ? ' (cached)' : ''}`
      pushMessage(convId, { id: newMsgId(), role: 'assistant', content: out })
    } catch (e) {
      pushMessage(convId, { id: newMsgId(), role: 'assistant', content: `Summarize failed: ${e instanceof Error ? e.message : 'unknown'}` })
    }
  }

  const runAction = (id: string) => {
    if (id === 'summarize') return void runSummarize()
    if (!user) { openSignIn(); return }
    const convId = `c${Date.now().toString(36)}`
    setActive(convId)
    pushMessage(convId, {
      id: newMsgId(),
      role: 'user',
      content: `Please ${id} this page: ${activeTab?.url ?? '(no active page)'}`,
    })
  }

  return (
    <div
      role="toolbar"
      aria-label="Quick actions"
      style={{
        display: 'flex',
        gap: 6,
        padding: 8,
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {ACTIONS.map((a) => (
        <button
          key={a.id}
          className="baobab-button"
          onClick={() => runAction(a.id)}
          style={{
            padding: '4px 10px',
            minHeight: 28,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-primary)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
