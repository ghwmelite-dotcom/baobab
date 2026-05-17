import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (next: string) => void
  onComplete?: (pin: string) => void
  disabled?: boolean
  shake?: boolean
  autoFocus?: boolean
}

export function PinInput({ value, onChange, onComplete, disabled, shake, autoFocus }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([null, null, null, null])
  const firedFor = useRef<string | null>(null)

  // Fire onComplete exactly once per completed value.
  useEffect(() => {
    if (value.length === 4 && onComplete && firedFor.current !== value) {
      firedFor.current = value
      onComplete(value)
    }
    if (value.length < 4) {
      firedFor.current = null
    }
  }, [value, onComplete])

  // Move focus forward as digits are added.
  useEffect(() => {
    if (disabled) return
    const idx = Math.min(value.length, 3)
    refs.current[idx]?.focus()
  }, [value.length, disabled])

  // Initial autofocus.
  useEffect(() => {
    if (autoFocus && !disabled) refs.current[0]?.focus()
  }, [autoFocus, disabled])

  function handleChange(i: number, raw: string) {
    if (raw === '') {
      // Browser cleared the box (e.g. via Delete).
      const next = value.slice(0, i)
      onChange(next)
      return
    }
    const ch = raw.slice(-1)
    if (!/^[0-9]$/.test(ch)) return  // ignore non-digit input
    const next = (value.slice(0, i) + ch).slice(0, 4)
    onChange(next)
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && value.length === i) {
      // Box i is empty (value has length i). Backspace removes the last filled digit.
      e.preventDefault()
      onChange(value.slice(0, Math.max(0, i - 1)))
    }
  }

  return (
    <div
      data-shake={shake ? 'true' : 'false'}
      style={{
        display: 'flex',
        gap: 10,
        animation: shake ? 'baobab-pin-shake 0.4s ease' : undefined,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          role="textbox"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`PIN digit ${i + 1}`}
          style={{
            width: 44,
            height: 56,
            fontSize: 28,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            textAlign: 'center',
            border: '2px solid rgba(60,30,15,0.3)',
            borderRadius: 10,
            background: 'rgba(255,250,240,0.95)',
            color: '#3c1810',
            outline: 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes baobab-pin-shake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-6px); }
          75%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
