import { useConnectionStore } from '~/state/connection.store'

export function NetworkChip() {
  const isSlow = useConnectionStore((s) => s.isSlow)
  const isOffline = useConnectionStore((s) => s.isOffline)
  const effectiveType = useConnectionStore((s) => s.effectiveType)
  const downlink = useConnectionStore((s) => s.downlinkMbps)
  const forced = useConnectionStore((s) => s.slowModeForced)

  if (effectiveType === 'unknown' && downlink === 0 && !isOffline) return null

  let label: string
  let dotColor: string
  let title: string
  if (isOffline) {
    label = 'Offline'
    dotColor = 'var(--text-muted)'
    title = 'No network detected.'
  } else if (forced) {
    label = 'Slow mode'
    dotColor = 'var(--sovereignty-warn)'
    title = 'You enabled slow mode in Settings.'
  } else if (isSlow) {
    const upper = effectiveType.toUpperCase()
    label = `Slow · ${upper}`
    dotColor = 'var(--sovereignty-warn)'
    title = 'Light pages — animations off, fonts deferred.'
  } else {
    label = downlink > 0 ? `Fast · ${Math.round(downlink)} Mbps` : 'Fast'
    dotColor = 'var(--sovereignty-ok)'
    title = 'Full quality.'
  }

  return (
    <span
      title={title}
      data-tauri-drag-region="false"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        paddingInline: 10,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'rgba(28, 24, 20, 0.55)',
        fontSize: 11,
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
      <span>{label}</span>
    </span>
  )
}
