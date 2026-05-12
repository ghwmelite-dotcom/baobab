import { useEffect, useState } from 'react'
import { useHistoryStore } from './history.store'
import { Button, IconButton, Input } from '@baobab/ui'

export function HistoryPanel() {
  const open = useHistoryStore((s) => s.drawerOpen)
  const items = useHistoryStore((s) => s.items)
  const refresh = useHistoryStore((s) => s.refresh)
  const clear = useHistoryStore((s) => s.clear)
  const toggle = useHistoryStore((s) => s.toggle)
  const [q, setQ] = useState('')

  useEffect(() => { if (open) void refresh() }, [open, refresh])
  useEffect(() => { if (open) { const t = setTimeout(() => void refresh(q), 200); return () => clearTimeout(t) } }, [q, open, refresh])

  if (!open) return null

  return (
    <aside
      aria-label="Browsing history"
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
        <strong>History</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={() => void clear()}>Clear all</Button>
          <IconButton aria-label="Close history drawer" onClick={toggle}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </IconButton>
        </div>
      </header>
      <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
        <Input
          placeholder="Search history…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search history"
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.length === 0 && (
          <p style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No history yet.</p>
        )}
        {items.map((h) => (
          <div key={h.id} style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {h.title ?? h.url}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{h.url}</div>
          </div>
        ))}
      </div>
    </aside>
  )
}
