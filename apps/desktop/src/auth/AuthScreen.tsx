import { useEffect, useState } from 'react'
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

  // Esc closes — auth is opt-in, never a wall.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={close}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(11, 9, 7, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 35,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'baobab-fade-in 180ms ease forwards',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to Baobab"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: '32px 32px 24px',
          color: 'var(--text-primary)',
          boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          animation: 'baobab-fade-in-up 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <h1 style={{
            fontFamily: 'var(--font-default)',
            fontSize: 26,
            margin: 0,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}>
            Sign in to {strings.appName}
          </h1>
          <p style={{
            margin: 0,
            color: 'var(--text-secondary)',
            fontSize: 13,
            lineHeight: 1.5,
          }}>
            Save bookmarks, history, and chats across devices. Otherwise, keep
            browsing — everything works without an account.
          </p>
        </div>

        <div
          role="tablist"
          style={{
            display: 'inline-flex',
            gap: 4,
            padding: 3,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            alignSelf: 'flex-start',
            marginTop: 4,
          }}
        >
          {(['phone', 'email'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={{
                padding: '5px 14px',
                minHeight: 28,
                borderRadius: 999,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                transition: 'background 140ms ease, color 140ms ease',
              }}
            >
              {t === 'phone' ? 'Phone' : 'Email'}
            </button>
          ))}
        </div>

        {tab === 'phone' ? <PhoneAuthForm /> : <EmailAuthForm />}

        <button
          type="button"
          onClick={close}
          style={{
            marginTop: 8,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12.5,
            padding: '6px 8px',
            alignSelf: 'center',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Continue without an account
        </button>
      </div>
    </div>
  )
}
