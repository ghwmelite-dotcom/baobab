export interface ReaderPillProps {
  onLoadFullPage: () => void
}

export function ReaderPill({ onLoadFullPage }: ReaderPillProps) {
  return (
    <button
      type="button"
      onClick={onLoadFullPage}
      title="Reader mode — click to load the full page"
      aria-label="Reader mode — click to load the full page"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 20,
        paddingInline: 8,
        marginRight: 6,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'rgba(217, 164, 90, 0.18)',
        color: 'var(--accent)',
        fontSize: 10.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden>📖</span>
      <span>Reader</span>
    </button>
  )
}
