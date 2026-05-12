import { useAuthStore } from '~/auth/auth.store'
import { useSettingsStore } from '../settings.store'

const MODELS = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B (default)' },
  { id: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (low bandwidth)' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 32B (code)' },
] as const

export function GeneralSection() {
  const user = useAuthStore((s) => s.user)
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel)
  const saving = useSettingsStore((s) => s.saving)
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>General</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Default AI model</span>
        <select
          value={user?.default_model ?? MODELS[0].id}
          onChange={(e) => void setDefaultModel(e.target.value)}
          disabled={saving}
          style={{
            minHeight: 36,
            paddingInline: 10,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}
