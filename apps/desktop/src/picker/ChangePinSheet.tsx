import { useEffect, useState } from 'react'
import { profileApi, type Profile } from '~/profiles/profile.api'
import { PinInput } from './PinInput'

type Mode = 'set' | 'change' | 'remove'

interface Props {
  open: boolean
  mode: Mode
  profile: Profile | null
  onClose: () => void
}

export function ChangePinSheet({ open, mode, profile, onClose }: Props) {
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lockSecs, setLockSecs] = useState<number | null>(null)

  function reset() {
    setCurrentPin(''); setNewPin(''); setConfirmPin(''); setErr(null); setBusy(false); setLockSecs(null)
  }

  // Tick down lockout countdown.
  useEffect(() => {
    if (lockSecs === null) return
    if (lockSecs <= 0) { setLockSecs(null); return }
    const t = setTimeout(() => setLockSecs(lockSecs - 1), 1000)
    return () => clearTimeout(t)
  }, [lockSecs])

  // Reset state on close (handles backdrop dismiss).
  useEffect(() => {
    if (!open) reset()
  }, [open])

  if (!open || !profile) return null

  const requiresCurrent = mode !== 'set'  // 'set' only valid when profile has no PIN; rendered by caller
  const requiresNew = mode !== 'remove'

  const locked = lockSecs !== null && lockSecs > 0
  const currentValid = !requiresCurrent || currentPin.length === 4
  const newValid = !requiresNew || (newPin.length === 4 && newPin === confirmPin)
  const canSubmit = currentValid && newValid && !busy && !locked

  function fmt(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !profile) return
    setBusy(true); setErr(null)
    try {
      if (mode === 'set') {
        await profileApi.setPin(profile.id, newPin)
      } else if (mode === 'change') {
        await profileApi.setPin(profile.id, newPin, currentPin)
      } else {
        await profileApi.removePin(profile.id, currentPin)
      }
      reset(); onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'wrong_pin') setErr('Current PIN is wrong.')
      else if (msg.startsWith('locked:')) {
        const secs = parseInt(msg.slice('locked:'.length), 10)
        setLockSecs(isNaN(secs) ? 30 : secs)
      }
      else setErr(msg)
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'set' ? `Set a PIN for ${profile.name}`
              : mode === 'change' ? `Change PIN for ${profile.name}`
              : `Remove PIN from ${profile.name}`

  return (
    <div role="dialog" aria-modal aria-label={title}
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
        <h2 style={{ margin: 0, color: '#3c1810', fontSize: 18 }}>{title}</h2>
        {requiresCurrent && (
          <div>
            <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>Current PIN</div>
            <PinInput value={currentPin} onChange={setCurrentPin} autoFocus disabled={busy || locked} />
          </div>
        )}
        {requiresNew && (
          <>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>New PIN</div>
              <PinInput value={newPin} onChange={setNewPin} disabled={busy || locked} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>Confirm new PIN</div>
              <PinInput value={confirmPin} onChange={setConfirmPin} disabled={busy || locked} />
            </div>
            {newPin.length === 4 && confirmPin.length === 4 && newPin !== confirmPin && (
              <div role="alert" style={{ color: '#a23a1f', fontSize: 12 }}>PINs don&apos;t match.</div>
            )}
          </>
        )}
        {locked && (
          <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>
            Too many wrong attempts. Try again in {fmt(lockSecs!)}
          </div>
        )}
        {err && !locked && <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => { reset(); onClose() }} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3c1810', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
            {busy ? 'Saving…' : mode === 'remove' ? 'Remove PIN' : 'Save PIN'}
          </button>
        </div>
      </form>
    </div>
  )
}
