import { useEffect } from 'react'
import { useBookmarksStore } from './bookmarks.store'
import { useTabsStore } from '~/state/tabs.store'
import { useDragWindow } from '~/chrome/useDragWindow'

export function BookmarksBar() {
  const bookmarks = useBookmarksStore((s) => s.bookmarks)
  const refresh = useBookmarksStore((s) => s.refresh)
  const activeId = useTabsStore((s) => s.activeId)
  const navigate = useTabsStore((s) => s.navigate)
  const openTab = useTabsStore((s) => s.openTab)
  const onDragMouseDown = useDragWindow()

  useEffect(() => {
    void refresh()
  }, [refresh])

  const topLevel = bookmarks.filter((b) => !b.folder_id)
  if (topLevel.length === 0) return null

  return (
    <nav
      aria-label="Bookmarks bar"
      data-tauri-drag-region
      onMouseDown={onDragMouseDown}
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        paddingInline: 8,
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {topLevel.map((b) => (
        <button
          key={b.id}
          onClick={() => (activeId ? void navigate(activeId, b.url) : void openTab(b.url))}
          title={b.url}
          style={{
            padding: '2px 8px',
            height: 22,
            borderRadius: 4,
            border: '1px solid transparent',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 11,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 200,
          }}
        >
          {b.title ?? b.url}
        </button>
      ))}
    </nav>
  )
}
