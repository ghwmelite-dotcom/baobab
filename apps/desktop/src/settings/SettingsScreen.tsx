import { useSettingsStore } from './settings.store'
import { GeneralSection } from './sections/GeneralSection'
import { PrivacySection } from './sections/PrivacySection'
import { AISection } from './sections/AISection'
import { SovereigntySection } from './sections/SovereigntySection'
import { useAuthStore } from '~/auth/auth.store'
import { Button, IconButton } from '@baobab/ui'

export function SettingsScreen() {
  const open = useSettingsStore((s) => s.open)
  const close = useSettingsStore((s) => s.close)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const openSignIn = useAuthStore((s) => s.openSignIn)

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--canvas)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-default)',
            fontSize: 22,
          }}
        >
          Settings
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {user ? (
            <Button variant="ghost" onClick={() => void logout()}>
              Sign out
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => { close(); openSignIn() }}>
              Sign in
            </Button>
          )}
          <IconButton aria-label="Close settings" onClick={close}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </IconButton>
        </div>
      </header>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 24,
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <GeneralSection />
        <PrivacySection />
        <AISection />
        <SovereigntySection />
      </div>
    </div>
  )
}
