import { useState, type FormEvent } from 'react'
import { useAuthStore } from './auth.store'
import { Button, Input } from '@baobab/ui'

export function PhoneAuthForm() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const otpSend = useAuthStore((s) => s.otpSend)
  const otpVerify = useAuthStore((s) => s.otpVerify)
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)

  const send = async (e: FormEvent) => {
    e.preventDefault()
    await otpSend(phone)
    setSent(true)
  }
  const verify = async (e: FormEvent) => {
    e.preventDefault()
    await otpVerify(phone, code).catch(() => undefined)
  }

  return (
    <form onSubmit={sent ? verify : send} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Phone number</span>
        <Input type="tel" required placeholder="+233…" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} />
      </label>
      {sent && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Verification code</span>
          <Input type="text" inputMode="numeric" pattern="[0-9]{4,8}" required value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
      )}
      {error && <div style={{ color: 'var(--critical)', fontSize: 12 }}>{error}</div>}
      <Button type="submit" loading={status === 'authing'}>
        {sent ? 'Verify and continue' : 'Send code'}
      </Button>
    </form>
  )
}
