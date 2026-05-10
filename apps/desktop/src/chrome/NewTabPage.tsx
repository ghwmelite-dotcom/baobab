import { strings } from '@baobab/brand'

const CAPABILITIES = [
  { title: 'Summarize', body: 'Give me the gist of any page.' },
  { title: 'Translate', body: 'Across major African languages (Yoruba, Swahili, Hausa).' },
  { title: 'Research', body: 'Compare sources, with African-source priority.' },
  { title: 'Compare', body: 'Lay options side by side.' },
  { title: 'Code', body: 'Explain or debug a code block.' },
  { title: 'Civic', body: 'Stay close to bills, courts, and regional policy.' },
] as const

export function NewTabPage() {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        background: 'var(--canvas)',
        color: 'var(--text-primary)',
        gap: 32,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'Recoleta, "General Sans", system-ui, sans-serif',
            fontSize: 56,
            fontWeight: 600,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {strings.appName}
        </h1>
        <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 15 }}>
          {strings.tagline}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(220px, 280px))',
          gap: 16,
          maxWidth: 880,
        }}
      >
        {CAPABILITIES.map((c) => (
          <div
            key={c.title}
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid var(--border)',
              background: 'var(--surface-1)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
            <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 13 }}>
              {c.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
