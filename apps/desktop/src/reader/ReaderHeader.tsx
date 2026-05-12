import { useReaderStore } from './reader.store'
import { Button, IconButton } from '@baobab/ui'

interface Props { onSaveOffline: () => void }

export function ReaderHeader({ onSaveOffline }: Props) {
  const a = useReaderStore((s) => s.article)
  const close = useReaderStore((s) => s.close)
  if (!a) return null
  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, borderBottom: '1px solid var(--border)', gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 22, margin: 0,
          color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{a.title}</h1>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          {a.word_count} words · {a.est_read_minutes} min · {a.ads_blocked} ads blocked
        </div>
      </div>
      <Button variant="secondary" onClick={onSaveOffline}>Save offline</Button>
      <IconButton aria-label="Close reader" onClick={close}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </IconButton>
    </header>
  )
}
