import type { ReactNode } from 'react'
import { IconButton } from '@baobab/ui'
import { useDownloadsStore, type DownloadItem } from './downloads.store'

export function DownloadsPanel() {
  const open = useDownloadsStore((s) => s.panelOpen)
  const downloads = useDownloadsStore((s) => s.downloads)
  const toggle = useDownloadsStore((s) => s.toggle)
  const clear = useDownloadsStore((s) => s.clear)
  const showInFolder = useDownloadsStore((s) => s.showInFolder)
  const openFile = useDownloadsStore((s) => s.openFile)

  if (!open) return null

  return (
    <aside
      aria-label="Downloads"
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
        fontFamily: 'var(--font-default)',
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
        <strong>Downloads</strong>
        <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {downloads.length > 0 && (
            <button
              type="button"
              onClick={clear}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 11,
                padding: '4px 8px',
                fontFamily: 'var(--font-default)',
              }}
            >
              Clear
            </button>
          )}
          <IconButton aria-label="Close downloads drawer" onClick={toggle}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </IconButton>
        </div>
      </header>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {downloads.length === 0 && (
          <p style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>
            No downloads yet.
          </p>
        )}
        {downloads.map((d) => (
          <Row
            key={d.id}
            item={d}
            onShow={() => void showInFolder(d.id)}
            onOpen={() => void openFile(d.id)}
          />
        ))}
      </div>
    </aside>
  )
}

interface RowProps {
  item: DownloadItem
  onShow: () => void
  onOpen: () => void
}

function Row({ item, onShow, onOpen }: RowProps) {
  const isDone = item.status === 'completed'
  const isFailed = item.status === 'failed'
  const isLive = item.status === 'in-progress'
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
        title={item.filename}
      >
        {item.filename}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)',
        }}
        title={item.url}
      >
        {item.url}
      </div>
      <div
        style={{
          marginTop: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <StatusBadge live={isLive} done={isDone} failed={isFailed} />
        <div style={{ display: 'inline-flex', gap: 6 }}>
          {isDone && (
            <RowAction onClick={onOpen}>Open</RowAction>
          )}
          {(isDone || isFailed) && (
            <RowAction onClick={onShow}>Show in folder</RowAction>
          )}
        </div>
      </div>
      <style>{pulseKeyframes}</style>
    </div>
  )
}

function StatusBadge({
  live,
  done,
  failed,
}: {
  live: boolean
  done: boolean
  failed: boolean
}) {
  if (live) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--accent-light, var(--text-secondary))',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent, currentColor)',
            animation: 'baobab-download-pulse 1.2s ease-in-out infinite',
          }}
        />
        Downloading…
      </span>
    )
  }
  if (done) {
    return (
      <span style={{ fontSize: 11, color: 'var(--sovereignty-ok, var(--text-secondary))' }}>
        Completed
      </span>
    )
  }
  if (failed) {
    return (
      <span style={{ fontSize: 11, color: 'var(--critical, var(--text-secondary))' }}>
        Failed
      </span>
    )
  }
  return null
}

function RowAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 11,
        padding: '3px 8px',
        fontFamily: 'var(--font-default)',
      }}
    >
      {children}
    </button>
  )
}

const pulseKeyframes = `
@keyframes baobab-download-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50%      { opacity: 1;    transform: scale(1.15); }
}
`
