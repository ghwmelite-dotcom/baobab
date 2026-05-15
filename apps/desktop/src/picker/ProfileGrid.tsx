import type { Profile } from '~/profiles/profile.api'
import { ProfileTile } from './ProfileTile'

interface Props {
  profiles: Profile[]
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onGuest: () => void
  onSetPin: (id: string) => void
  onChangePin: (id: string) => void
  onRemovePin: (id: string) => void
}

export function ProfileGrid({ profiles, onSelect, onRename, onDelete, onAdd, onGuest, onSetPin, onChangePin, onRemovePin }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 144px)', gap: 24, justifyContent: 'center' }}>
      {profiles.map((p) => (
        <ProfileTile key={p.id} profile={p} onSelect={onSelect} onRename={onRename} onDelete={onDelete} onSetPin={onSetPin} onChangePin={onChangePin} onRemovePin={onRemovePin} />
      ))}
      <button
        type="button" aria-label="Create new profile" onClick={onAdd}
        style={{
          width: 144, height: 144, borderRadius: 18,
          background: 'rgba(255,250,240,0.15)', border: '2px dashed rgba(255,250,240,0.6)',
          color: 'rgba(255,250,240,0.9)', fontSize: 38, fontWeight: 300, cursor: 'pointer',
        }}
      >+</button>
      <button
        type="button" aria-label="Open guest window" onClick={onGuest}
        style={{
          width: 144, height: 144, borderRadius: 18, background: 'rgba(255,250,240,0.7)',
          border: 'none', color: '#3c1810', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span aria-hidden style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #c0b5a0, #6a5a48)',
          border: '2px solid rgba(255,255,255,0.85)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, marginBottom: 10,
        }}>G</span>
        <span style={{ fontStyle: 'italic', fontSize: 14 }}>Guest</span>
      </button>
    </div>
  )
}
