import { useState } from 'react'

const API_BASE = 'https://baobab-api.ohcsghana-main.workers.dev'

interface SearchResponse {
  answer: string
  results: Array<{ title: string; url: string }>
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ok'; data: SearchResponse }
  | { phase: 'error'; kind: 'rate-limited' | 'network' | 'server'; detail?: string }

export function AiDemo() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    if (!navigator.onLine) {
      setState({ phase: 'error', kind: 'network', detail: 'offline' })
      return
    }
    setState({ phase: 'loading' })
    try {
      const r = await fetch(`${API_BASE}/api/ai/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (r.status === 429) {
        setState({ phase: 'error', kind: 'rate-limited' })
        return
      }
      if (!r.ok) {
        setState({ phase: 'error', kind: 'server', detail: `${r.status}` })
        return
      }
      const data = (await r.json()) as SearchResponse
      setState({ phase: 'ok', data })
    } catch (err) {
      setState({
        phase: 'error',
        kind: 'network',
        detail: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about Africa…"
          aria-label="Search query"
          style={{
            flex: 1,
            padding: '14px 16px',
            background: 'var(--canvas)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            fontSize: 16,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={state.phase === 'loading' || !query.trim()}
          style={{
            background: 'var(--accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            padding: '14px 22px',
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            cursor: state.phase === 'loading' || !query.trim() ? 'default' : 'pointer',
            opacity: state.phase === 'loading' || !query.trim() ? 0.55 : 1,
          }}
        >
          {state.phase === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div
        role="status"
        aria-live="polite"
        style={{ marginTop: 24 }}
      >
        {state.phase === 'idle' && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Powered by Workers AI on Cloudflare's African edge. Rate-limited; install Baobab for the full experience.
          </p>
        )}
        {state.phase === 'loading' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>Reaching across the continent…</p>
        )}
        {state.phase === 'ok' && (
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: 16, lineHeight: 1.65, margin: '0 0 16px' }}>
              {state.data.answer}
            </p>
            {state.data.results.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {state.data.results.slice(0, 5).map((r) => (
                  <li key={r.url} style={{ marginBottom: 12 }}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 14 }}
                    >
                      {r.title}
                    </a>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.url}</div>
                  </li>
                ))}
              </ul>
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
              Try the full version with bookmarks, history and translate — <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a>.
            </p>
          </div>
        )}
        {state.phase === 'error' && state.kind === 'rate-limited' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            You've used your demo quota — <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a> for unlimited use.
          </p>
        )}
        {state.phase === 'error' && state.kind === 'network' && state.detail === 'offline' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            You're offline — Baobab works offline once installed.
          </p>
        )}
        {state.phase === 'error' && state.kind === 'network' && state.detail !== 'offline' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            Network error — try again, or <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a>.
          </p>
        )}
        {state.phase === 'error' && state.kind === 'server' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            AI is temporarily unavailable ({state.detail}) — <a href="#download" style={{ color: 'var(--accent)' }}>install Baobab</a> for local translation + reader.
          </p>
        )}
      </div>
    </div>
  )
}
