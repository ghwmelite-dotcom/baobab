import { useState } from 'react'
import { strings } from '@baobab/brand'
import { IconButton } from '@baobab/ui'
import { EmailAuthForm } from './EmailAuthForm'
import { PhoneAuthForm } from './PhoneAuthForm'
import { useAuthStore } from './auth.store'

type Tab = 'phone' | 'email'

export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('phone')
  const open = useAuthStore((s) => s.signInOverlayOpen)
  const close = useAuthStore((s) => s.closeSignIn)
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--canvas)',
        color: 'var(--text-primary)',
        zIndex: 35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconButton
        aria-label="Close sign-in"
        onClick={close}
        style={{ position: 'absolute', top: 12, right: 12 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </IconButton>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Recoleta, "General Sans", system-ui, sans-serif', fontSize: 40, margin: 0 }}>{strings.appName}</h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{strings.tagline}</p>
        <div role="tablist" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {(['phone', 'email'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 16px', minHeight: 36, borderRadius: 999,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? 'var(--text-on-accent)' : 'var(--text-primary)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >
              {t === 'phone' ? 'Phone' : 'Email'}
            </button>
          ))}
        </div>
        {tab === 'phone' ? <PhoneAuthForm /> : <EmailAuthForm />}
      </div>
    </div>
  )
}
