import { useAuthStore } from '~/auth/auth.store'
import { useSettingsStore } from '../settings.store'

export function AISection() {
  const user = useAuthStore((s) => s.user)
  const setLowBandwidth = useSettingsStore((s) => s.setLowBandwidth)
  const saving = useSettingsStore((s) => s.saving)
  const lowBwOn = (user?.low_bandwidth_mode ?? 0) === 1
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>AI</h2>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={lowBwOn}
          onChange={(e) => void setLowBandwidth(e.target.checked)}
          disabled={saving}
        />
        <span>
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>Low bandwidth mode</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Use the 8B model and skip embeddings to save data.
          </div>
        </span>
      </label>
    </section>
  )
}
