import { useState } from 'react'
import { FRUIT_COLOR_ORDER, FRUIT_HEX, type FruitColor } from '~/profiles/fruitColors'
import { PinInput } from './PinInput'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (name: string, color: FruitColor, pin?: string) => Promise<void>
}

export function NewProfileSheet({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<FruitColor>('mango')
  const [lock, setLock] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) return null

  const pinValid = !lock || (pin.length === 4 && pin === confirmPin)
  const canSubmit = name.trim().length > 0 && pinValid && !busy

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setErr(null)
    try {
      await onCreate(name.trim(), color, lock ? pin : undefined)
      setName(''); setColor('mango'); setLock(false); setPin(''); setConfirmPin('')
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'create failed')
    } finally { setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal aria-label="Create a new profile"
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
        <h2 style={{ margin: 0, color: '#3c1810' }}>New profile</h2>
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
        <div>
          <div style={{ color: '#3c1810', fontSize: 13, marginBottom: 6 }}>Fruit colour</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {FRUIT_COLOR_ORDER.map((c) => (
              <button
                key={c} type="button" aria-label={`Use ${c}`} aria-pressed={c === color}
                onClick={() => setColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `radial-gradient(circle at 30% 30%, ${FRUIT_HEX[c].from}, ${FRUIT_HEX[c].to})`,
                  border: c === color ? '3px solid #3c1810' : '2px solid rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3c1810', fontSize: 13 }}>
          <input
            type="checkbox"
            checked={lock}
            onChange={(e) => setLock(e.target.checked)}
            aria-label="Lock this profile with a PIN"
          />
          Lock this profile with a 4-digit PIN
        </label>
        {lock && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: 'rgba(60,24,16,0.75)', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              Anyone using this computer will need the PIN to open this profile. If you forget it,
              you&apos;ll need to delete the profile to start over. The PIN does not encrypt your data on disk.
            </p>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>PIN</div>
              <PinInput value={pin} onChange={setPin} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#3c1810', marginBottom: 4 }}>Confirm PIN</div>
              <PinInput value={confirmPin} onChange={setConfirmPin} />
            </div>
            {pin.length === 4 && confirmPin.length === 4 && pin !== confirmPin && (
              <div role="alert" style={{ color: '#a23a1f', fontSize: 12 }}>PINs don&apos;t match.</div>
            )}
          </div>
        )}
        {err && <div role="alert" style={{ color: '#a23a1f', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(60,30,15,0.3)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={!canSubmit}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3c1810', color: 'white', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.5 }}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
