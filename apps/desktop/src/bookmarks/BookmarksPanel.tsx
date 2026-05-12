import { useEffect } from 'react'
import { IconButton } from '@baobab/ui'
import { useBookmarksStore } from './bookmarks.store'

export function BookmarksPanel() {
  const open = useBookmarksStore((s) => s.drawerOpen)
  const bookmarks = useBookmarksStore((s) => s.bookmarks)
  const folders = useBookmarksStore((s) => s.folders)
  const refresh = useBookmarksStore((s) => s.refresh)
  const toggle = useBookmarksStore((s) => s.toggle)
  const remove = useBookmarksStore((s) => s.remove)

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  if (!open) return null

  return (
    <aside
      aria-label="Bookmarks"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        zIndex: 15,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: 12,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <strong>Bookmarks</strong>
        <IconButton aria-label="Close bookmarks drawer" onClick={toggle}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </IconButton>
      </header>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {bookmarks.length === 0 && (
          <p style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            No bookmarks yet.
          </p>
        )}
        {folders.map((f) => {
          const inFolder = bookmarks.filter((b) => b.folder_id === f.id)
          if (inFolder.length === 0) return null
          return (
            <div key={f.id}>
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {f.name}
              </div>
              {inFolder.map((b) => (
                <Item key={b.id} bookmark={b} onRemove={() => void remove(b.id)} />
              ))}
            </div>
          )
        })}
        {bookmarks
          .filter((b) => !b.folder_id)
          .map((b) => (
            <Item key={b.id} bookmark={b} onRemove={() => void remove(b.id)} />
          ))}
      </div>
    </aside>
  )
}

interface ItemProps {
  bookmark: { id: string; url: string; title: string | null }
  onRemove: () => void
}
function Item({ bookmark, onRemove }: ItemProps) {
  return (
    <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-primary)',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {bookmark.title ?? bookmark.url}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{bookmark.url}</div>
      <button
        onClick={onRemove}
        style={{
          marginTop: 4,
          fontSize: 11,
          color: 'var(--critical)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Remove
      </button>
    </div>
  )
}
