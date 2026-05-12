import { useTranslation } from 'react-i18next'
import { useTabsStore } from '~/state/tabs.store'
import { aiClient } from './api'
import { useAiStore } from './ai.store'
import { strings } from '@baobab/brand'
import { useAuthStore } from '~/auth/auth.store'

type ActionId = 'summarize' | 'translate' | 'extract' | 'compare' | 'explain'

const ACTION_IDS: ReadonlyArray<ActionId> = ['summarize', 'translate', 'extract', 'compare', 'explain']

const ACTION_LABEL_KEY: Record<ActionId, string> = {
  summarize: 'quickActions.summarize',
  translate: 'quickActions.translate',
  extract: 'quickActions.extract',
  compare: 'quickActions.compare',
  explain: 'quickActions.explain',
}

function newMsgId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function QuickActions() {
  const { t } = useTranslation()
  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const activeTab = tabs.find((tab) => tab.id === activeId)
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
      pushMessage(convId, {
        id: newMsgId(),
        role: 'assistant',
        content: t('quickActions.summarizeFailed', { error: e instanceof Error ? e.message : 'unknown' }),
      })
    }
  }

  const runAction = (id: ActionId) => {
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
      aria-label={t('quickActions.ariaLabel')}
      style={{
        display: 'flex',
        gap: 6,
        padding: 8,
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {ACTION_IDS.map((id) => (
        <button
          key={id}
          className="baobab-button"
          onClick={() => runAction(id)}
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
          {t(ACTION_LABEL_KEY[id])}
        </button>
      ))}
    </div>
  )
}
