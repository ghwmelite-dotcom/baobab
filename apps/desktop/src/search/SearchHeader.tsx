import { useEffect, useState } from 'react'

interface Props {
  query: string
  onRefine: (next: string) => void
}

export function SearchHeader({ query, onRefine }: Props) {
  const [value, setValue] = useState(query)

  useEffect(() => { setValue(query) }, [query])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const trimmed = value.trim()
    if (!trimmed) return
    onRefine(trimmed)
  }

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 10,
        height: 56, boxSizing: 'border-box',
        background: 'rgba(255,250,240,0.96)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(60,30,15,0.12)',
      }}
    >
      <div style={{
        maxWidth: 760,
        height: '100%',
        margin: '0 auto',
        padding: '10px 24px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #5a8a1f, #2d5310)',
            border: '1.5px solid rgba(255,255,255,0.7)',
          }} />
          <span style={{
            fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
            fontSize: 16, fontWeight: 600, color: '#3c1810', letterSpacing: '-0.01em',
          }}>baobab</span>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Search the grove"
          style={{
            flex: 1, height: 40, padding: '0 20px',
            borderRadius: 999,
            border: '1px solid rgba(60,30,15,0.18)',
            background: 'white',
            color: '#3c1810',
            fontSize: 14,
            outline: 'none',
            transition: 'border-color 120ms ease',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#c4881f' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(60,30,15,0.18)' }}
        />
      </div>
    </header>
  )
}
