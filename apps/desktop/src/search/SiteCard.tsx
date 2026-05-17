import type { SearchSiteCard } from '@baobab/cloud-client'

const COUNTRY_FLAG: Record<string, string> = {
  NG: '🇳🇬', KE: '🇰🇪', ZA: '🇿🇦', GH: '🇬🇭', ET: '🇪🇹', TZ: '🇹🇿',
  UG: '🇺🇬', ZW: '🇿🇼', CI: '🇨🇮', SN: '🇸🇳', ML: '🇲🇱', MA: '🇲🇦',
  EG: '🇪🇬', DZ: '🇩🇿', MZ: '🇲🇿', PAN: '🌍',
}

export function SiteCard({ card }: { card: SearchSiteCard }) {
  return (
    <div style={{
      background: '#fffaf2', borderRadius: 16,
      padding: '24px 28px', boxShadow: '0 4px 24px rgba(60,24,16,0.06)',
      marginBottom: 24, border: '1px solid rgba(60,24,16,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        {card.logoUrl ? (
          <img src={card.logoUrl} alt="" width={56} height={56}
            style={{ borderRadius: 12, objectFit: 'contain', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: 12, background: '#1a4480',
            color: 'white', fontWeight: 700, fontSize: 28,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>{card.name.charAt(0)}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, color: '#1a4480', fontWeight: 600, lineHeight: 1.2 }}>{card.name}</div>
          <div style={{ fontSize: 13, color: '#6f4a2c', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            {card.country && COUNTRY_FLAG[card.country] && <span>{COUNTRY_FLAG[card.country]}</span>}
            {new URL(card.url).hostname}
          </div>
        </div>
        <a href={card.url} target="_blank" rel="noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 38, padding: '0 22px', background: '#1a4480',
          color: 'white', borderRadius: 999, textDecoration: 'none',
          fontSize: 14, fontWeight: 500, flexShrink: 0,
        }}>Visit ↗</a>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: '#3c1810', marginBottom: 18 }}>
        {card.description}
      </div>
      {card.sitelinks.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(4, Math.min(6, card.sitelinks.length))}, 1fr)`,
          gap: 10,
          paddingTop: 16, borderTop: '1px dashed rgba(60,24,16,0.18)',
        }}>
          {card.sitelinks.slice(0, 6).map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" style={{
              padding: '10px 14px',
              background: 'rgba(217,119,6,0.08)',
              border: '1px solid rgba(217,119,6,0.18)',
              borderRadius: 8, textDecoration: 'none',
              fontSize: 13, color: '#6f3a14', textAlign: 'center',
            }}>
              <div style={{ fontWeight: 500 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#8a6e3a', marginTop: 2 }}>{s.path}</div>
            </a>
          ))}
        </div>
      )}
      {card.country && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: 'rgba(217,119,6,0.08)',
          borderLeft: '3px solid #c4881f', borderRadius: 6,
          fontSize: 12, color: '#6f4a2c', lineHeight: 1.6,
        }}>
          🌍 <strong>African-founded.</strong> Headquartered in {flagLabel(card.country)}.
        </div>
      )}
    </div>
  )
}

function flagLabel(iso: string): string {
  const COUNTRY_NAME: Record<string, string> = {
    NG: 'Nigeria', KE: 'Kenya', ZA: 'South Africa', GH: 'Ghana', ET: 'Ethiopia',
    TZ: 'Tanzania', UG: 'Uganda', EG: 'Egypt', SN: 'Senegal', ML: 'Mali',
    MA: 'Morocco', CI: "Côte d'Ivoire", PAN: 'Africa',
  }
  return COUNTRY_NAME[iso] ?? iso
}
