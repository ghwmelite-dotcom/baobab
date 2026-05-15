import { useEffect, useState } from 'react'
import type { Profile } from '~/profiles/profile.api'

interface Props {
  open: boolean
  profile: Profile | null
  onClose: () => void
  onRename: (id: string, newName: string) => Promise<void>
}

export function RenameSheet({ open, profile, onClose, onRename }: Props) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open && profile) { setName(profile.name); setErr(null); setBusy(false) }
    if (!open) { setName(''); setErr(null); setBusy(false) }
  }, [open, profile])

  if (!open || !profile) return null

  const trimmed = name.trim()
  const canSubmit = trimmed.length > 0 && trimmed !== profile.name && !busy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !profile) return
    setBusy(true); setErr(null)
    try {
      await onRename(profile.id, trimmed)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal aria-label={`Rename ${profile.name}`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(60,20,10,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: '#fde7c4', borderRadius: '16px 16px 0 0',
          padding: 24, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h2 style={{ margin: 0, color: '#3c1810', fontSize: 18 }}>Rename profile</h2>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#3c1810', fontSize: 13 }}>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={48}
            required
            style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(60,30,15,0.2)', fontSize: 14 }}
          />
        </label>
        {err && <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3c1810', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
