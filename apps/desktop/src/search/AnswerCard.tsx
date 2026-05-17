import type { SearchCitation } from '@baobab/cloud-client'

interface Props {
  answer: { en: string; bilingual?: { lang: string; text: string } }
  citations: SearchCitation[]
}

const LANG_NAME: Record<string, string> = {
  yo: 'Yorùbá', sw: 'Swahili', ha: 'Hausa', ig: 'Igbo', am: 'Amharic',
  zu: 'Zulu', xh: 'Xhosa', wo: 'Wolof', ak: 'Akan',
}

const COUNTRY_FLAG: Record<string, string> = {
  NG: '🇳🇬', KE: '🇰🇪', ZA: '🇿🇦', GH: '🇬🇭', ET: '🇪🇹', TZ: '🇹🇿',
  UG: '🇺🇬', ZW: '🇿🇼', CI: '🇨🇮', SN: '🇸🇳', ML: '🇲🇱', MA: '🇲🇦',
  EG: '🇪🇬', DZ: '🇩🇿', MZ: '🇲🇿', PAN: '🌍',
}

export function AnswerCard({ answer, citations }: Props) {
  const bilingual = answer.bilingual
  return (
    <section
      style={{
        margin: '24px 24px 16px',
        background: '#fffaf2',
        border: '1px solid rgba(196,136,31,0.35)',
        borderLeft: '4px solid #c4881f',
        borderRadius: 12,
        padding: '28px 32px',
        boxShadow: '0 4px 24px rgba(60,24,16,0.06)',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#8a6e3a',
          marginBottom: 12,
          fontWeight: 700,
        }}
      >
        From the Grove{bilingual ? ' · Bilingual' : ''}
      </div>

      {bilingual ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <LangTag label="English" />
            <p style={{
              margin: 0,
              fontSize: 14.5,
              lineHeight: 1.65,
              color: '#3c1810',
              fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
            }}>
              {answer.en}
            </p>
          </div>
          <div>
            <LangTag label={LANG_NAME[bilingual.lang] ?? bilingual.lang} />
            <p style={{
              margin: 0,
              fontSize: 14.5,
              lineHeight: 1.65,
              color: '#3c1810',
              fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
            }}>
              {bilingual.text}
            </p>
          </div>
        </div>
      ) : (
        <p style={{
          margin: 0,
          fontSize: 15.5,
          lineHeight: 1.7,
          color: '#3c1810',
          fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
          whiteSpace: 'pre-wrap',
        }}>
          {answer.en}
        </p>
      )}

      {citations.length > 0 && (
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px dashed rgba(60,24,16,0.18)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#8a6e3a',
            marginRight: 4,
          }}>
            African voices cited:
          </span>
          {citations.map((c, i) => (
            <a
              key={i}
              {...(c.url ? { href: c.url, target: '_blank', rel: 'noreferrer' } : {})}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                background: 'rgba(217,119,6,0.12)',
                border: '1px solid rgba(217,119,6,0.3)',
                borderRadius: 999,
                fontSize: 12,
                color: '#6f3a14',
                textDecoration: 'none',
              }}
            >
              {COUNTRY_FLAG[c.country] ?? ''} {c.name}
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

function LangTag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      background: 'rgba(217,119,6,0.12)',
      color: '#6f3a14',
      fontSize: 10,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      borderRadius: 4,
      marginBottom: 8,
      fontWeight: 600,
    }}>
      {label}
    </span>
  )
}
