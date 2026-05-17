import { useEffect, useRef, useState } from 'react'

export interface CountdownModalProps {
  url: string
  seconds?: number
  onAccept: () => void
  onCancel: () => void
}

export function CountdownModal({ url, seconds = 3, onAccept, onCancel }: CountdownModalProps) {
  const [remaining, setRemaining] = useState(seconds)
  const acceptedRef = useRef(false)
  const cancelledRef = useRef(false)

  // Latch the first decision so a click on Cancel doesn't get overruled
  // by a countdown-tick that lands in the same React commit.
  const fireAccept = () => {
    if (acceptedRef.current || cancelledRef.current) return
    acceptedRef.current = true
    onAccept()
  }
  const fireCancel = () => {
    if (acceptedRef.current || cancelledRef.current) return
    cancelledRef.current = true
    onCancel()
  }

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          // Defer to avoid setState-during-render
          queueMicrotask(fireAccept)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fireCancel() }
      else if (e.key === 'Enter') { e.preventDefault(); fireAccept() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Heavy page on slow mode"
      onClick={(e) => { if (e.target === e.currentTarget) fireCancel() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9100,
      }}
    >
      <div
        style={{
          minWidth: 320, maxWidth: 440,
          background: 'var(--surface-1)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)',
          borderRadius: 10, padding: '18px 20px',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)',
          fontFamily: 'var(--font-default)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Heavy page on slow mode</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, wordBreak: 'break-all' }}>{url}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Opening in Reader in {remaining}…
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={fireCancel}
            style={ghostBtn}
          >Cancel</button>
          <button
            type="button"
            onClick={fireAccept}
            style={accentBtn}
            autoFocus
          >Open now</button>
        </div>
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '6px 14px', fontSize: 12.5, cursor: 'pointer',
}
const accentBtn: React.CSSProperties = {
  background: 'var(--accent)', color: 'var(--text-on-accent)',
  border: 'none', borderRadius: 8,
  padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
}
