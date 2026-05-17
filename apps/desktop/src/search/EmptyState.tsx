import { GroveTree } from '~/picker/GroveTree'

interface Props {
  query: string
}

export function EmptyState({ query }: Props) {
  return (
    <section
      style={{
        margin: '48px auto', maxWidth: 480, textAlign: 'center',
        padding: '0 24px',
      }}
    >
      <div style={{ display: 'inline-block', opacity: 0.7 }}>
        <GroveTree size={64} />
      </div>
      <h2 style={{
        fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
        fontSize: 20, color: '#3c1810', margin: '12px 0 6px', letterSpacing: '-0.01em',
      }}>
        No grove results for &ldquo;{query}&rdquo;
      </h2>
      <p style={{ fontSize: 14, color: 'rgba(60,30,15,0.7)', margin: 0 }}>
        Try a different query, or refine your search above.
      </p>
    </section>
  )
}
