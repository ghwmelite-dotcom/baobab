import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? 'https://baobab-api.ohcsghana-main.workers.dev'

interface ReaderResponse {
  title: string
  cleaned_html: string
  text: string
  word_count: number
  est_read_minutes: number
  ads_blocked: number
  trackers_blocked: number
  ai_summary: string
  key_points: string[]
  cached: boolean
  bytes_saved: number
  bytes_saved_adblock: number
}

function detectSkipAi(): boolean {
  // reader.html doesn't share connection.store with the chrome. Read
  // navigator.connection directly. Mirrors connection.store.compute() logic
  // from Bundle A.
  const c = (navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; saveData?: boolean }
  }).connection
  const eff = c?.effectiveType ?? 'unknown'
  const dl = typeof c?.downlink === 'number' ? c.downlink : 0
  const saveData = c?.saveData === true
  return eff === 'slow-2g' || eff === '2g' || (dl > 0 && dl < 1.5) || saveData
}

function formatMb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function reportSavings(saved: number): void {
  // bytes_used is 0 here because engine.js's fetch hook (Bundle A) already
  // counted the /api/proxy/fetch response's Content-Length on the way in.
  const inv = (window as Window & { __TAURI_INTERNALS__?: { invoke: (n: string, p: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
  if (!inv?.invoke) return
  inv.invoke('record_tab_usage', { bytesUsed: 0, bytesSaved: saved }).catch(() => {})
}

export function ReaderApp() {
  const urlParam = new URLSearchParams(location.search).get('url')
  const [data, setData] = useState<ReaderResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!!urlParam)

  useEffect(() => {
    if (!urlParam) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/proxy/fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlParam, skip_ai: detectSkipAi() }),
        })
        if (!res.ok) throw new Error(`${res.status}`)
        const json = (await res.json()) as ReaderResponse
        if (!alive) return
        if (!json.cleaned_html || json.word_count < 20) {
          setError('extraction-failed')
        } else {
          setData(json)
          reportSavings(json.bytes_saved + json.bytes_saved_adblock)
        }
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'fetch-failed')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [urlParam])

  if (!urlParam) {
    return <ErrorPane title="No URL provided" originalUrl={null} />
  }
  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-default)' }}>Reading carefully…</div>
  }
  if (error || !data) {
    return <ErrorPane title="Couldn't load this page in Reader." originalUrl={urlParam} detail={error ?? undefined} />
  }
  return (
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '24px 32px', fontFamily: 'var(--font-default)' }}>
      <header style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>📖 saved ≈ {formatMb(data.bytes_saved + data.bytes_saved_adblock)} · {data.est_read_minutes} min read · {data.ads_blocked} ads blocked</span>
        <a href={urlParam} style={{ color: 'var(--accent)', textDecoration: 'none' }}>Load full page</a>
      </header>
      <h1 style={{ fontSize: 28, lineHeight: 1.25, color: 'var(--text-primary)' }}>{data.title}</h1>
      <div
        style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text-primary)' }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.cleaned_html, { USE_PROFILES: { html: true } }) }}
      />
    </article>
  )
}

function ErrorPane({ title, originalUrl, detail }: { title: string; originalUrl: string | null; detail?: string }) {
  return (
    <div style={{ maxWidth: 480, margin: '120px auto', padding: 24, fontFamily: 'var(--font-default)' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h1>
      {detail && import.meta.env.DEV && (
        <pre style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{detail}</pre>
      )}
      {originalUrl && (
        <a href={originalUrl} style={{ color: 'var(--accent)' }}>Load full page</a>
      )}
    </div>
  )
}
