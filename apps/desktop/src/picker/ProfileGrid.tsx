import type { Profile } from '~/profiles/profile.api'
import { ProfileTile } from './ProfileTile'

interface Props {
  profiles: Profile[]
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onSetPin: (id: string) => void
  onChangePin: (id: string) => void
  onRemovePin: (id: string) => void
}

export function ProfileGrid({ profiles, onSelect, onRename, onDelete, onAdd, onSetPin, onChangePin, onRemovePin }: Props) {
  return (
    <div data-tauri-drag-region="false" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 144px)', gap: 24, justifyContent: 'center' }}>
      {profiles.map((p) => (
        <ProfileTile key={p.id} profile={p} onSelect={onSelect} onRename={onRename} onDelete={onDelete} onSetPin={onSetPin} onChangePin={onChangePin} onRemovePin={onRemovePin} />
      ))}
      <button
        type="button" aria-label="Create new profile" onClick={onAdd}
        data-tauri-drag-region="false"
        style={{
          width: 144, height: 144, borderRadius: 18,
          background: 'rgba(255,250,240,0.15)', border: '2px dashed rgba(255,250,240,0.6)',
          color: 'rgba(255,250,240,0.9)', fontSize: 38, fontWeight: 300, cursor: 'pointer',
        }}
      >+</button>
    </div>
  )
}
