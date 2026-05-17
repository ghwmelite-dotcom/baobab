import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '~/i18n'
import { useAuthStore, type HeritageLanguage } from '~/auth/auth.store'

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

const HERITAGE_LANGUAGES: Array<{ code: HeritageLanguage | ''; label: string }> = [
  { code: '', label: 'None' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'sw', label: 'Swahili' },
  { code: 'ha', label: 'Hausa' },
  { code: 'ig', label: 'Igbo' },
  { code: 'am', label: 'Amharic' },
  { code: 'zu', label: 'Zulu' },
  { code: 'xh', label: 'Xhosa' },
  { code: 'wo', label: 'Wolof' },
  { code: 'ak', label: 'Akan' },
]

export function LanguageSection() {
  const { t, i18n } = useTranslation()
  const currentBase = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const current: SupportedLanguage = isSupportedLanguage(currentBase) ? currentBase : 'en'

  const heritage = useAuthStore((s) => s.heritageLanguage)
  const setHeritage = useAuthStore((s) => s.setHeritageLanguage)

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
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          Heritage language for answers
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Answers will render in English and this language side-by-side. Independent of UI language.
        </span>
        <select
          aria-label="Heritage language for answers"
          value={heritage ?? ''}
          onChange={(e) => setHeritage((e.target.value || null) as HeritageLanguage | null)}
          style={{
            background: 'var(--surface-1)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 13,
            marginTop: 4,
          }}
        >
          {HERITAGE_LANGUAGES.map((h) => (
            <option key={h.code} value={h.code}>{h.label}</option>
          ))}
        </select>
      </label>
    </section>
  )
}
