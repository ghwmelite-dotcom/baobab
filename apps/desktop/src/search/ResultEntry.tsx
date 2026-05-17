import { useState } from 'react'
import type { SearchResult } from './useSearchData'

interface Props {
  result: SearchResult
}

export function ResultEntry({ result }: Props) {
  const [hovered, setHovered] = useState(false)
  return (
    <article
      style={{ marginBottom: 16 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 12, color: '#8a3a1f', marginBottom: 2 }}>
        {prettyUrl(result.url)}
      </div>
      <a
        href={result.url}
        style={{
          fontSize: 18,
          color: '#1a4a8a',
          textDecoration: hovered ? 'underline' : 'none',
          fontWeight: 600,
          display: 'inline-block',
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'transform 120ms ease, text-decoration 120ms ease',
        }}
      >
        {result.title}
      </a>
    </article>
  )
}

function prettyUrl(raw: string): string {
  try {
    const u = new URL(raw)
    const path = u.pathname.replace(/\/$/, '')
    return path ? `${u.hostname} › ${path.replace(/^\//, '').replace(/\//g, ' › ')}` : u.hostname
  } catch {
    return raw
  }
}
