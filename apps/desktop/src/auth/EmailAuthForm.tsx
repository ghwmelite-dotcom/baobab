import { useState, type FormEvent } from 'react'
import { useAuthStore } from './auth.store'
import { Button, Input } from '@baobab/ui'

type Mode = 'login' | 'signup'

export function EmailAuthForm() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const loginEmail = useAuthStore((s) => s.loginEmail)
  const signupEmail = useAuthStore((s) => s.signupEmail)
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'login') await loginEmail(email, password).catch(() => undefined)
    else await signupEmail(email, password).catch(() => undefined)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email address</span>
        <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Password</span>
        <Input
          type="password"
          required
          minLength={12}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <div style={{ color: 'var(--critical)', fontSize: 12 }}>{error}</div>}
      <Button type="submit" loading={status === 'authing'}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}
      >
        {mode === 'login' ? "Don't have an account? Sign up." : 'Already have an account? Sign in.'}
      </button>
    </form>
  )
}
