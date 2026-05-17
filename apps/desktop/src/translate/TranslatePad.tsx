import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useTranslateStore } from './translate.store'

// ── Language catalog ─────────────────────────────────────────────────────
// Order is intentional: African languages first, then the global lingua-francas
// used widely across the continent. Codes are ISO 639-1; speech BCP-47 maps
// each to a regional default so SpeechSynthesis picks a sensible voice.

const SOURCE_LANGS: readonly string[] = ['auto', 'en', 'yo', 'sw', 'ha', 'am', 'wo', 'zu', 'fr', 'ar']
const TARGET_LANGS: readonly string[] = ['en', 'yo', 'sw', 'ha', 'am', 'wo', 'zu', 'fr', 'ar']

const BCP47: Record<string, string> = {
  en: 'en-US',
  yo: 'yo-NG',
  sw: 'sw-KE',
  ha: 'ha-NG',
  am: 'am-ET',
  wo: 'wo-SN',
  zu: 'zu-ZA',
  fr: 'fr-FR',
  ar: 'ar-EG',
}

// ── Panel ────────────────────────────────────────────────────────────────

export function TranslatePad() {
  const { t } = useTranslation()
  const open = useTranslateStore((s) => s.open)
  const sourceLang = useTranslateStore((s) => s.sourceLang)
  const targetLang = useTranslateStore((s) => s.targetLang)
  const sourceText = useTranslateStore((s) => s.sourceText)
  const translatedText = useTranslateStore((s) => s.translatedText)
  const loading = useTranslateStore((s) => s.loading)
  const error = useTranslateStore((s) => s.error)

  const setSourceLang = useTranslateStore((s) => s.setSourceLang)
  const setTargetLang = useTranslateStore((s) => s.setTargetLang)
  const setSourceText = useTranslateStore((s) => s.setSourceText)
  const swapLangs = useTranslateStore((s) => s.swapLangs)
  const translate = useTranslateStore((s) => s.translate)
  const close = useTranslateStore((s) => s.close)

  const sourceRef = useRef<HTMLTextAreaElement | null>(null)

  // Esc closes the pad. We only attach the listener while open so we don't
  // shadow other Esc-handlers (e.g. the omnibar blur) when the pad is hidden.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    // Focus the source textarea on open so the user can start typing immediately.
    sourceRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  const speak = () => {
    if (!translatedText) return
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(translatedText)
    u.lang = BCP47[targetLang] ?? targetLang
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  const labelFor = (code: string): string => {
    const key = `translate.languages.${code}` as const
    const translated = t(key)
    return translated === key ? code.toUpperCase() : translated
  }

  return (
    <div
      role="dialog"
      aria-label={t('translate.title')}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(720px, calc(100% - 32px))',
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        boxShadow: '0 24px 48px -12px rgba(0,0,0,0.45)',
        padding: 20,
        zIndex: 30,
        animation: 'translate-pad-slide-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes translate-pad-slide-in {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to   { transform: translate(-50%, 0);     opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-translate-pad-root] { animation: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-default)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}
        >
          {t('translate.title')}
        </h2>
        <button
          type="button"
          aria-label={t('translate.close')}
          onClick={close}
          style={iconBtn}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Source row */}
      <Row
        langs={SOURCE_LANGS}
        langValue={sourceLang}
        onLangChange={setSourceLang}
        labelFor={labelFor}
      >
        <textarea
          ref={sourceRef}
          rows={4}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder={t('translate.sourcePlaceholder')}
          aria-label={t('translate.sourcePlaceholder')}
          style={textArea}
        />
      </Row>

      {/* Action strip — swap + translate button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBlock: 12,
        }}
      >
        <button
          type="button"
          aria-label={t('translate.swap')}
          title={t('translate.swap')}
          onClick={swapLangs}
          style={iconBtn}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path
              d="M4 4 H12 L10 2 M12 4 L10 6 M12 12 H4 L6 14 M4 12 L6 10"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => void translate()}
          disabled={loading || !sourceText.trim()}
          style={{
            ...pillBtn,
            opacity: loading || !sourceText.trim() ? 0.55 : 1,
            cursor: loading || !sourceText.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? t('translate.translatingBtn') : t('translate.translateBtn')}
        </button>
      </div>

      {/* Target row */}
      <Row
        langs={TARGET_LANGS}
        langValue={targetLang}
        onLangChange={setTargetLang}
        labelFor={labelFor}
      >
        <textarea
          rows={4}
          value={translatedText}
          readOnly
          placeholder={t('translate.translatedPlaceholder')}
          aria-label={t('translate.translatedPlaceholder')}
          style={{ ...textArea, background: 'var(--canvas)' }}
        />
      </Row>

      {/* Footer actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
        <button
          type="button"
          onClick={speak}
          disabled={!translatedText}
          aria-label={t('translate.speak')}
          style={{
            ...ghostBtn,
            opacity: translatedText ? 1 : 0.5,
            cursor: translatedText ? 'pointer' : 'default',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden style={{ marginRight: 6 }}>
            <path
              d="M2 5 H4 L7 2 V12 L4 9 H2 Z"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinejoin="round"
            />
            <path d="M9.5 4 A3 3 0 0 1 9.5 10 M11 2 A5 5 0 0 1 11 12" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </svg>
          {t('translate.speak')}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            marginTop: 10,
            marginBottom: 0,
            fontSize: 12,
            color: 'var(--critical)',
            fontFamily: 'var(--font-default)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}

// ── Small building blocks ────────────────────────────────────────────────

function Row({
  langs,
  langValue,
  onLangChange,
  labelFor,
  children,
}: {
  langs: readonly string[]
  langValue: string
  onLangChange: (l: string) => void
  labelFor: (code: string) => string
  children: React.ReactNode
}) {
  return (
    <div>
      <select
        value={langValue}
        onChange={(e) => onLangChange(e.target.value)}
        style={{
          fontFamily: 'var(--font-default)',
          fontSize: 12.5,
          background: 'var(--canvas)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 10px',
          marginBottom: 6,
          cursor: 'pointer',
        }}
      >
        {langs.map((code) => (
          <option key={code} value={code}>
            {labelFor(code)}
          </option>
        ))}
      </select>
      {children}
    </div>
  )
}

// ── Inline style fragments ───────────────────────────────────────────────

const textArea: CSSProperties = {
  width: '100%',
  resize: 'vertical',
  padding: 12,
  fontFamily: 'var(--font-default)',
  fontSize: 14,
  lineHeight: 1.55,
  color: 'var(--text-primary)',
  background: 'var(--canvas)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  outline: 'none',
}

const iconBtn: CSSProperties = {
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  cursor: 'pointer',
}

const pillBtn: CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--text-on-accent)',
  border: 'none',
  borderRadius: 999,
  padding: '10px 22px',
  fontFamily: 'var(--font-default)',
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: '0.01em',
}

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 12px',
  fontFamily: 'var(--font-default)',
  fontSize: 12.5,
}
