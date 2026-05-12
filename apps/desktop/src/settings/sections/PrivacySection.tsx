import { useAuthStore } from '~/auth/auth.store'
import { useSettingsStore } from '../settings.store'

export function PrivacySection() {
  const user = useAuthStore((s) => s.user)
  const setPrivacyMode = useSettingsStore((s) => s.setPrivacyMode)
  const saving = useSettingsStore((s) => s.saving)
  const privacyOn = (user?.privacy_mode ?? 0) === 1
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>Privacy</h2>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={privacyOn}
          onChange={(e) => void setPrivacyMode(e.target.checked)}
          disabled={saving}
        />
        <span>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Privacy mode</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Stop recording browsing history.
          </div>
        </span>
      </label>
    </section>
  )
}
