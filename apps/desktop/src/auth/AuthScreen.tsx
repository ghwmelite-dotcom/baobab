import { useState } from 'react'
import { strings } from '@baobab/brand'
import { EmailAuthForm } from './EmailAuthForm'
import { PhoneAuthForm } from './PhoneAuthForm'

type Tab = 'phone' | 'email'

export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('phone')
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', color: 'var(--text-primary)' }}>
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
