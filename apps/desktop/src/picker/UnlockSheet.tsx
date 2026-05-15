import { useEffect, useState } from 'react'
import { FRUIT_HEX } from '~/profiles/fruitColors'
import { profileApi, type Profile } from '~/profiles/profile.api'
import { PinInput } from './PinInput'

interface Props {
  open: boolean
  profile: Profile | null
  onClose: () => void
}

export function UnlockSheet({ open, profile, onClose }: Props) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lockSecs, setLockSecs] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  // Tick down lockout countdown.
  useEffect(() => {
    if (lockSecs === null) return
    if (lockSecs <= 0) { setLockSecs(null); return }
    const t = setTimeout(() => setLockSecs(lockSecs - 1), 1000)
    return () => clearTimeout(t)
  }, [lockSecs])

  // Reset state on close.
  useEffect(() => {
    if (!open) {
      setPin(''); setShake(false); setErr(null); setLockSecs(null); setBusy(false)
    }
  }, [open])

  if (!open || !profile) return null
  const { from, to } = FRUIT_HEX[profile.fruitColor]
  const locked = lockSecs !== null && lockSecs > 0

  async function tryUnlock(entered: string) {
    if (busy || locked || !profile) return
    setBusy(true); setErr(null); setShake(false)
    try {
      await profileApi.openProfileWindow(profile.id, entered)
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.startsWith('locked:')) {
        const secs = parseInt(msg.slice('locked:'.length), 10)
        setLockSecs(isNaN(secs) ? 30 : secs)
        setErr(null)
      } else if (msg === 'wrong_pin') {
        setShake(true)
        setErr('Wrong PIN. Try again.')
        // Clear the input on the next tick so the boxes empty after the shake registers.
        setTimeout(() => { setPin(''); setShake(false) }, 450)
      } else {
        setErr(msg)
      }
    } finally {
      setBusy(false)
    }
  }

  function fmt(secs: number) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div role="dialog" aria-modal aria-label={`Unlock ${profile.name}`}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(60,20,10,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
      }}
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => e.preventDefault()}
        style={{
          background: '#fde7c4', borderRadius: '16px 16px 0 0',
          padding: 24, width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}
      >
        <div aria-hidden style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
          border: '2px solid rgba(255,255,255,0.85)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700,
        }}>{profile.avatarLetter}</div>
        <h2 style={{ margin: 0, color: '#3c1810', fontSize: 18 }}>Unlock {profile.name}</h2>
        <PinInput
          value={pin}
          onChange={setPin}
          onComplete={tryUnlock}
          disabled={busy || locked}
          shake={shake}
          autoFocus
        />
        {locked && (
          <div style={{ color: '#a23a1f', fontSize: 13 }}>
            Try again in {fmt(lockSecs!)}
          </div>
        )}
        {err && !locked && (
          <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>
        )}
        <button type="button" onClick={onClose}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </form>
    </div>
  )
}
