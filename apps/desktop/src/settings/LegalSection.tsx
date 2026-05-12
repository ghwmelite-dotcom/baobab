import type { CSSProperties, ReactNode } from 'react'

const DEPENDENCIES: ReadonlyArray<{ name: string; license: string }> = [
  { name: 'Tauri 2.0', license: 'Apache-2.0 / MIT' },
  { name: 'React', license: 'MIT' },
  { name: 'Cloudflare Workers SDK', license: 'BSD-3' },
  { name: 'Hono', license: 'MIT' },
  { name: 'Zustand', license: 'MIT' },
  { name: 'DOMPurify', license: 'Apache-2.0 / MPL-2.0' },
  { name: 'Fraunces', license: 'SIL OFL 1.1' },
  { name: 'Bookman Old Style fallback (TeX Gyre Bonum)', license: 'GUST Font License' },
  { name: 'JetBrains Mono', license: 'SIL OFL 1.1' },
]

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'var(--font-default)',
  fontSize: 14,
  color: 'var(--text-secondary)',
  padding: '10px 0',
  listStyle: 'none',
  userSelect: 'none',
  transition: 'color 120ms ease-out',
}

const bodyStyle: CSSProperties = {
  fontFamily: 'var(--font-default)',
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--text-secondary)',
  maxWidth: 640,
  margin: '4px 0 12px',
}

const detailsStyle: CSSProperties = {
  borderTop: '1px solid var(--border)',
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details style={detailsStyle}>
      <summary
        style={summaryStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)'
        }}
      >
        {title}
      </summary>
      <div style={bodyStyle}>{children}</div>
    </details>
  )
}

export default function LegalSection() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <h2
        style={{
          margin: '24px 0 8px',
          fontFamily: 'var(--font-default)',
          fontWeight: 600,
          fontSize: 18,
          color: 'var(--text-primary)',
        }}
      >
        Legal
      </h2>
      <Disclosure title="Privacy">
        <p style={{ margin: 0 }}>
          Baobab keeps your browsing local by default. Optional sync stores bookmarks,
          history, and chats on Cloudflare&apos;s African edge &mdash; D1 for structured
          data, R2 for content. We never sell your data, share it with third parties, or
          train models on it. Local mode keeps everything on this device; sync only
          activates when you sign in.
        </p>
      </Disclosure>
      <Disclosure title="Terms of Use">
        <p style={{ margin: 0 }}>
          Baobab is alpha software released under the AGPL-3.0 license. It&apos;s provided
          as-is, without warranty. Source code lives at github.com/ghwmelite-dotcom/baobab.
          By using it you accept that things may break, data may move during the alpha,
          and we&apos;ll fix issues as we find them.
        </p>
      </Disclosure>
      <Disclosure title="Open-Source Licenses">
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {DEPENDENCIES.map((dep) => (
            <li key={dep.name} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                style={{
                  fontFamily: 'var(--font-default)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              >
                {dep.name}
              </span>
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                &middot; {dep.license}
              </span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </section>
  )
}
