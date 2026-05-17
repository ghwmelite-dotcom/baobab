import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '~/i18n'

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export function LanguageSection() {
  const { t, i18n } = useTranslation()
  const currentBase = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const current: SupportedLanguage = isSupportedLanguage(currentBase) ? currentBase : 'en'

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{t('settings.language.title')}</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {t('settings.language.label')}
        </span>
        <select
          value={current}
          onChange={(e) => {
            const next = e.target.value
            if (isSupportedLanguage(next)) {
              void i18n.changeLanguage(next)
            }
          }}
          aria-label={t('settings.language.label')}
          style={{
            minHeight: 36,
            paddingInline: 10,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          {SUPPORTED_LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {t(`settings.language.options.${code}`)}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {t('settings.language.description')}
        </span>
      </label>
    </section>
  )
}
