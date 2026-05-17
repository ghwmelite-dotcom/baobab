interface Props {
  sourceCount: number
  countryCount: number
  africanVoicePercent: number
}

export function DiversityMeter({ sourceCount, countryCount, africanVoicePercent }: Props) {
  if (sourceCount === 0) return null
  return (
    <div
      style={{
        background: 'rgba(217,119,6,0.06)',
        border: '1px solid rgba(217,119,6,0.18)',
        borderRadius: 10,
        padding: '12px 18px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        fontSize: 12,
      }}
    >
      <Stat num={sourceCount} label="Sources" />
      <Stat num={countryCount} label="Countries" />
      <div style={{ flex: 1 }}>
        <div style={{
          height: 6,
          background: 'rgba(60,24,16,0.1)',
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${africanVoicePercent}%`,
            background: 'linear-gradient(90deg, #d97706, #c4881f)',
            borderRadius: 3,
          }} />
        </div>
        <div style={{
          fontSize: 11,
          color: '#6f3a14',
          marginTop: 4,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>African voices</span>
          <strong>{africanVoicePercent}%</strong>
        </div>
      </div>
    </div>
  )
}

function Stat({ num, label }: { num: number; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#6f3a14', lineHeight: 1 }}>{num}</div>
      <div style={{
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#8a6e3a',
        marginTop: 3,
      }}>
        {label}
      </div>
    </div>
  )
}
