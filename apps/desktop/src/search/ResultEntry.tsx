import type { SearchResult } from '@baobab/cloud-client'

const COUNTRY_FLAG: Record<string, string> = {
  NG: '🇳🇬', KE: '🇰🇪', ZA: '🇿🇦', GH: '🇬🇭', ET: '🇪🇹', TZ: '🇹🇿',
  UG: '🇺🇬', ZW: '🇿🇼', CI: '🇨🇮', SN: '🇸🇳', ML: '🇲🇱', MA: '🇲🇦',
  EG: '🇪🇬', DZ: '🇩🇿', MZ: '🇲🇿', PAN: '🌍',
}

export function ResultEntry({ result }: { result: SearchResult }) {
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(60,24,16,0.08)' }}>
      <div style={{
        fontSize: 12, color: '#8a6e3a', marginBottom: 2,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {result.country && COUNTRY_FLAG[result.country] && <span>{COUNTRY_FLAG[result.country]}</span>}
        {result.source}
        {result.isAfrican && (
          <span style={{
            display: 'inline-block', padding: '2px 7px',
            background: 'rgba(217,119,6,0.15)', color: '#8b4513',
            fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            borderRadius: 4, marginLeft: 8, fontWeight: 600,
          }}>African Source</span>
        )}
      </div>
      <a href={result.url} target="_self" style={{
        fontSize: 16, color: '#1a4480', fontWeight: 500,
        textDecoration: 'none', display: 'block', marginBottom: 4,
      }}>{result.title}</a>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: '#4a3520' }}>{result.snippet}</div>
    </div>
  )
}
