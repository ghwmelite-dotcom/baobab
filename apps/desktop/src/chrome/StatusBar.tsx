import { strings } from '@baobab/brand'
import { useSovereigntyStore } from '~/state/sovereignty.store'

export function StatusBar() {
  const residency = useSovereigntyStore((s) => s.residency)
  const ads = useSovereigntyStore((s) => s.adsBlocked)
  const ms = useSovereigntyStore((s) => s.pageLoadMs)
  const lowBwMode = useSovereigntyStore((s) => s.lowBwMode)
  const setLowBwMode = useSovereigntyStore((s) => s.setLowBwMode)

  const isHome = residency.region === 'africa'
  const label = residency.region === 'unknown' ? '—' : isHome ? strings.residency.home : strings.residency.roaming
  const tooltip = isHome ? strings.tooltips.home : strings.tooltips.roaming
  const dotColor = isHome ? 'var(--sovereignty-ok)' : 'var(--sovereignty-warn)'

  return (
    <footer
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        paddingInline: 12,
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-muted)',
      }}
    >
      <span title={tooltip} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            display: 'inline-block',
          }}
        />
        <span style={{ color: 'var(--text-secondary)' }}>
          {label}
          {residency.colo !== 'unknown' && ` · ${residency.colo}`}
        </span>
      </span>

      <span title="Ads blocked on this page">{ads} blocked</span>
      <span title="Page load time">{ms != null ? `${ms} ms` : '—'}</span>

      <button
        type="button"
        className="baobab-button"
        onClick={() => setLowBwMode(lowBwMode === 'on' ? 'auto' : 'on')}
        title={strings.tooltips.lowBandwidth}
        style={{
          marginLeft: 'auto',
          height: 22,
          paddingInline: 8,
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: lowBwMode === 'on' ? 'var(--accent-dim)' : 'transparent',
          color: lowBwMode === 'on' ? 'var(--accent-light)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        Low bandwidth: {lowBwMode}
      </button>
    </footer>
  )
}
