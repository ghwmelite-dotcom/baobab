import { useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? 'https://baobab-api.ohcsghana-main.workers.dev'

export interface SummarizePillProps {
  text: string
  onSummary: (summary: string) => void
}

export function SummarizePill({ text, onSummary }: SummarizePillProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 6000) }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json() as { summary?: string; response?: string }
      const summary = json.summary ?? json.response ?? ''
      if (!summary) throw new Error('empty')
      onSummary(summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{
          background: 'rgba(217, 164, 90, 0.18)',
          color: 'var(--accent)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          marginLeft: 8,
        }}
      >
        {loading ? 'Summarizing…' : '+ Summarize'}
      </button>
      {error && (
        <span role="alert" style={{ marginLeft: 8, fontSize: 11, color: 'var(--critical)' }}>
          Couldn't summarize — try again later.
        </span>
      )}
    </>
  )
}
