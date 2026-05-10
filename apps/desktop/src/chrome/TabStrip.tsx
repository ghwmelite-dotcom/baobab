import { useTabsStore } from '~/state/tabs.store'
import type { Tab } from '@baobab/core'

interface Props {
  height?: number
}

const TAB_WIDTH_MIN = 120
const TAB_WIDTH_MAX = 220

export function TabStrip({ height = 40 }: Props) {
  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const setActive = useTabsStore((s) => s.setActive)
  const closeTab = useTabsStore((s) => s.closeTab)
  const openTab = useTabsStore((s) => s.openTab)

  return (
    <div
      role="tablist"
      style={{
        height,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'var(--surface-2)',
        borderBottom: '1px solid var(--border)',
        gap: 2,
        paddingInline: 4,
      }}
    >
      {tabs.map((t) => (
        <TabButton
          key={t.id}
          tab={t}
          active={t.id === activeId}
          onSelect={() => setActive(t.id)}
          onClose={() => void closeTab(t.id)}
        />
      ))}
      <button
        onClick={() => void openTab('about:blank')}
        aria-label="New tab"
        style={{
          height: '100%',
          width: 36,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        +
      </button>
    </div>
  )
}

function TabButton({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: Tab
  active: boolean
  onSelect: () => void
  onClose: () => void
}) {
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect()
      }}
      style={{
        height: '100%',
        minWidth: TAB_WIDTH_MIN,
        maxWidth: TAB_WIDTH_MAX,
        flex: '1 1 0',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingInline: 12,
        background: active ? 'var(--canvas)' : 'transparent',
        borderTop: active ? '2px solid var(--accent)' : '2px solid transparent',
        borderRadius: '6px 6px 0 0',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        userSelect: 'none',
        overflow: 'hidden',
      }}
      title={tab.url}
    >
      {tab.pinned && <span style={{ color: 'var(--accent)' }}>•</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {tab.title || tab.url}
      </span>
      <button
        aria-label="Close tab"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{
          marginLeft: 'auto',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          opacity: 0.6,
          padding: 2,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
