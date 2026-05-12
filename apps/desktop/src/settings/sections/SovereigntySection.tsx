import { useTranslation } from 'react-i18next'
import { useSovereigntyStore } from '~/state/sovereignty.store'
import { strings } from '@baobab/brand'

export function SovereigntySection() {
  const { t } = useTranslation()
  const residency = useSovereigntyStore((s) => s.residency)
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{t('settings.sovereignty.title')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('settings.sovereignty.currentRegion')}</div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
          {residency.region === 'africa'
            ? strings.residency.home
            : residency.region === 'edge-fallback'
              ? strings.residency.roaming
              : '—'}{' '}
          {residency.colo !== 'unknown' && `· ${residency.colo}`}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {residency.dataResidency || t('settings.sovereignty.unknown')}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
        {strings.tooltips.home} {t('settings.sovereignty.footer')}
      </p>
    </section>
  )
}
