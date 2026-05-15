import { useState } from 'react'
import type { Profile } from '~/profiles/profile.api'

interface Props {
  open: boolean
  profile: Profile | null
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}

export function ConfirmDeleteSheet({ open, profile, onClose, onDelete }: Props) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open || !profile) return null

  async function handleConfirm() {
    if (busy || !profile) return
    setBusy(true); setErr(null)
    try {
      await onDelete(profile.id)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal aria-label={`Delete ${profile.name}?`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(60,20,10,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fde7c4', borderRadius: '16px 16px 0 0',
          padding: 24, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <h2 style={{ margin: 0, color: '#3c1810', fontSize: 18 }}>Delete &ldquo;{profile.name}&rdquo;?</h2>
        <p style={{ margin: 0, color: 'rgba(60,24,16,0.85)', fontSize: 13, lineHeight: 1.5 }}>
          This wipes all data for this profile: tabs, history, bookmarks, cookies, and AI chat. The action can&apos;t be undone.
        </p>
        {err && <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#a23a1f', color: 'white', cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Deleting…' : 'Delete profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
