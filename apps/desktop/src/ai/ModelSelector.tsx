const MODELS = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B (default)' },
  { id: '@cf/meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B (low bandwidth)' },
  { id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 32B (code)' },
] as const

interface Props {
  value: string | undefined
  onChange: (id: string) => void
}

export function ModelSelector({ value, onChange }: Props) {
  return (
    <select
      value={value ?? MODELS[0].id}
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 28,
        paddingInline: 8,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--surface-2)',
        color: 'var(--text-primary)',
        fontSize: 11,
      }}
      aria-label="AI model"
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  )
}
