import { useEffect } from 'react'
import { useAdblockStore } from '~/adblock/adblock.store'
import { useProfile } from '~/profiles/useProfile'

function relativeTime(iso: string): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (isNaN(then)) return iso
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function AdblockSection() {
  const profile = useProfile()
  const enabled = useAdblockStore((s) => s.enabled)
  const lastUpdated = useAdblockStore((s) => s.lastUpdated)
  const source = useAdblockStore((s) => s.source)
  const refreshing = useAdblockStore((s) => s.refreshing)
  const error = useAdblockStore((s) => s.error)
  const hydrate = useAdblockStore((s) => s.hydrate)
  const setEnabled = useAdblockStore((s) => s.setEnabled)
  const refresh = useAdblockStore((s) => s.refresh)

  useEffect(() => {
    if (profile?.id) void hydrate(profile.id)
  }, [profile?.id, hydrate])

  if (!profile) return null

  return (
    <section style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Ad blocker</h2>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => void setEnabled(profile.id, e.target.checked)}
          aria-label="Block ads and trackers"
        />
        Block ads and trackers
      </label>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        Toggle off if a site breaks. Per-site allowlist coming soon. Changes apply to new tabs.
      </p>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Filter lists last updated: <strong>{relativeTime(lastUpdated)}</strong>
          {source.kind === 'Bundled' && ' (bundled)'}
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label="Refresh filter lists now"
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)',
            background: 'var(--surface-1)', cursor: refreshing ? 'wait' : 'pointer',
            fontSize: 12,
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh filter lists'}
        </button>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 10, color: 'var(--danger)', fontSize: 12 }}>
          {error}
        </div>
      )}
    </section>
  )
}
