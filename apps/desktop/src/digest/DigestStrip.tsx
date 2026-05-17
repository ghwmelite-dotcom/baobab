import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDigestStore, type DigestItem } from './digest.store'
import { useTabsStore } from '~/state/tabs.store'

// Horizontal scrolling strip of "issue cards" — daily digest of African
// headlines, AI-summarized. Sits below the capability grid on the NTP.

function DigestCard({ item, index }: { item: DigestItem; index: number }) {
  const { t } = useTranslation()
  const [hover, setHover] = useState(false)

  const open = () => {
    void useTabsStore.getState().openTab(item.url)
  }

  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      onKeyDown={onKey}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={`${item.title} — ${t('ntp.digest.readOn', { source: item.source.name })}`}
      style={{
        flex: '0 0 auto',
        width: 280,
        minHeight: 180,
        scrollSnapAlign: 'start',
        padding: '16px 18px 14px 18px',
        textAlign: 'left',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderTopColor: hover ? 'var(--accent-light)' : 'var(--border)',
        borderRadius: 14,
        color: 'var(--text-primary)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition:
          'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms ease, ' +
          'box-shadow 220ms ease, background 220ms ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover
          ? '0 12px 32px -16px rgba(217, 119, 6, 0.32), 0 1px 0 rgba(255,255,255,0.04) inset'
          : '0 1px 0 rgba(255,255,255,0.03) inset',
        opacity: 0,
        animation: 'baobab-fade-in-up 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        animationDelay: `${80 * index}ms`,
      }}
    >
      {/* Source eyebrow — italic small caps */}
      <div
        style={{
          fontFamily: 'var(--font-default)',
          fontStyle: 'italic',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {item.source.name}
      </div>

      {/* Title — characterful serif, 3-line clamp */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          lineHeight: 1.2,
          fontWeight: 500,
          color: 'var(--text-primary)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.title}
      </div>

      {/* Summary — Bookman, 5-line clamp */}
      <div
        style={{
          fontFamily: 'var(--font-default)',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
          display: '-webkit-box',
          WebkitLineClamp: 5,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: '1 1 auto',
        }}
      >
        {item.summary}
      </div>

      {/* Footer — Read on {source} */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 6,
          fontFamily: 'var(--font-default)',
          fontSize: 11.5,
          letterSpacing: '0.04em',
          color: hover ? 'var(--accent-light)' : 'var(--text-muted)',
          transition: 'color 220ms ease',
        }}
      >
        {t('ntp.digest.readOn', { source: item.source.name })}
      </div>
    </button>
  )
}

export function DigestStrip() {
  const { t } = useTranslation()
  const items = useDigestStore((s) => s.items)
  const loading = useDigestStore((s) => s.loading)
  const loaded = useDigestStore((s) => s.loaded)
  const fetchDigest = useDigestStore((s) => s.fetch)

  useEffect(() => {
    if (!loaded && !loading) {
      void fetchDigest()
    }
  }, [loaded, loading, fetchDigest])

  return (
    <section
      aria-label={t('ntp.digest.heading')}
      style={{
        marginTop: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-default)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.005em',
          color: 'var(--text-primary)',
        }}
      >
        {t('ntp.digest.heading')}
      </h2>

      {items.length === 0 ? (
        <div
          style={{
            fontFamily: 'var(--font-default)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--text-muted)',
          }}
        >
          {loading ? t('ntp.digest.loading') : t('ntp.digest.empty')}
        </div>
      ) : (
        <div
          className="baobab-scroll"
          style={{
            display: 'flex',
            gap: 14,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            paddingBottom: 6,
            // Negative margin trick so cards align with the rest of the column
            // while the scrollable region extends to the gutter edge.
            margin: '0 -4px',
            padding: '0 4px 6px 4px',
          }}
        >
          {items.map((item, i) => (
            <DigestCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}
    </section>
  )
}
