import { useState } from 'react'
import { FRUIT_HEX } from '~/profiles/fruitColors'
import type { Profile } from '~/profiles/profile.api'

interface Props {
  profile: Profile
  onSelect: (id: string) => void
  onRename?: (id: string) => void
  onDelete?: (id: string) => void
}

export function ProfileTile({ profile, onSelect, onRename, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { from, to } = FRUIT_HEX[profile.fruitColor]

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Open ${profile.name}`}
        onClick={() => onSelect(profile.id)}
        style={{
          appearance: 'none', cursor: 'pointer', border: 'none', background: 'rgba(255,250,240,0.95)',
          borderRadius: 16, padding: 16, width: 120, height: 120,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(60,20,10,0.25)',
          color: '#3c1810', fontWeight: 600,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
            border: '2px solid rgba(255,255,255,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, marginBottom: 8,
            boxShadow: '0 3px 8px rgba(60,20,10,0.35), inset 0 -3px 6px rgba(0,0,0,0.2)',
          }}
        >
          {profile.avatarLetter}
        </span>
        <span style={{ fontSize: 13 }}>{profile.name}</span>
      </button>
      {(onRename || onDelete) && (
        <>
          <button
            type="button"
            aria-label={`More options for ${profile.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            style={{
              position: 'absolute', top: 6, right: 6, width: 24, height: 24,
              border: 'none', background: 'transparent', cursor: 'pointer', color: '#3c1810',
              fontSize: 16, lineHeight: 1, borderRadius: 12,
            }}
          >···</button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute', top: 32, right: 6, background: 'white',
                borderRadius: 8, boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
                padding: 4, minWidth: 120, zIndex: 10,
              }}
            >
              {onRename && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRename(profile.id) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                  Rename
                </button>
              )}
              {onDelete && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(profile.id) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#a23a1f' }}>
                  Delete
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
