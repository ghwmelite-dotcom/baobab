interface Props {
  answer: string
}

export function AnswerCard({ answer }: Props) {
  if (!answer) return null
  return (
    <section
      style={{
        margin: '24px 24px 16px',
        padding: '20px 22px',
        background: '#fffbef',
        border: '1px solid rgba(196,136,31,0.35)',
        borderLeft: '4px solid #c4881f',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(60,30,15,0.08)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: '#c4881f',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        From the grove
      </div>
      <p
        style={{
          margin: 0,
          color: '#3c1810',
          fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
          fontSize: 16,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}
      >
        {answer}
      </p>
    </section>
  )
}
