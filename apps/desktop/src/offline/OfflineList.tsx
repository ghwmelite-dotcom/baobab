import { useEffect } from 'react'
import { useOfflineStore } from './offline.store'
import { strings } from '@baobab/brand'
import { IconButton } from '@baobab/ui'

export function OfflineList() {
  const open = useOfflineStore((s) => s.drawerOpen)
  const items = useOfflineStore((s) => s.items)
  const refresh = useOfflineStore((s) => s.refresh)
  const toggle = useOfflineStore((s) => s.toggle)
  const remove = useOfflineStore((s) => s.remove)

  useEffect(() => { if (open) void refresh() }, [open, refresh])

  if (!open) return null

  return (
    <aside
      aria-label="Saved articles"
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, zIndex: 15,
        background: 'var(--surface-1)', borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <header style={{
        padding: 12, borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <strong>{strings.residency.saved}</strong>
        <IconButton aria-label="Close saved drawer" onClick={toggle}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </IconButton>
      </header>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.length === 0 && (
          <p style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>Nothing saved yet.</p>
        )}
        {items.map((a) => (
          <div key={a.id} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{a.title ?? a.url}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a.url} · {a.est_read_minutes} min</div>
            <button
              onClick={() => void remove(a.id)}
              style={{
                marginTop: 4, fontSize: 11, color: 'var(--critical)',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
