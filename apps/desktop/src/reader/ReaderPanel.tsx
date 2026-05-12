import { useReaderStore } from './reader.store'
import { ReaderHeader } from './ReaderHeader'
import DOMPurify from 'dompurify'
import { useOfflineStore } from '~/offline/offline.store'

export function ReaderPanel() {
  const open = useReaderStore((s) => s.open)
  const a = useReaderStore((s) => s.article)
  const loading = useReaderStore((s) => s.loading)
  const error = useReaderStore((s) => s.error)
  const saveOffline = useOfflineStore((s) => s.save)

  if (!open) return null

  const onSaveOffline = async () => { if (a) await saveOffline(a) }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'var(--canvas)', zIndex: 20,
      display: 'flex', flexDirection: 'column',
    }}>
      <ReaderHeader onSaveOffline={onSaveOffline} />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 48px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
        {loading && <p style={{ color: 'var(--text-muted)' }}>Reading carefully…</p>}
        {error && <p style={{ color: 'var(--critical)' }}>{error}</p>}
        {a && (
          <>
            {a.ai_summary && (
              <aside style={{
                background: 'var(--surface-1)', borderRadius: 12, padding: 16,
                marginBottom: 24, border: '1px solid var(--border)',
              }}>
                <strong style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AI summary</strong>
                <p style={{ marginTop: 8, color: 'var(--text-primary)', fontSize: 14 }}>{a.ai_summary}</p>
                {a.key_points.length > 0 && (
                  <ul style={{ marginTop: 8, paddingLeft: 18, color: 'var(--text-primary)', fontSize: 13 }}>
                    {a.key_points.map((p, i) => (<li key={i}>{p}</li>))}
                  </ul>
                )}
              </aside>
            )}
            <article
              style={{
                fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 18,
                lineHeight: 1.7, color: 'var(--text-primary)',
              }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(a.cleaned_html, { USE_PROFILES: { html: true } }),
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
