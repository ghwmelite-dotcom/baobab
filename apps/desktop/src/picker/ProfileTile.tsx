import { useState } from 'react'
import { FRUIT_HEX } from '~/profiles/fruitColors'
import type { Profile } from '~/profiles/profile.api'

interface Props {
  profile: Profile
  onSelect: (id: string) => void
  onRename?: (id: string) => void
  onDelete?: (id: string) => void
  onSetPin?: (id: string) => void
  onChangePin?: (id: string) => void
  onRemovePin?: (id: string) => void
}

export function ProfileTile({ profile, onSelect, onRename, onDelete, onSetPin, onChangePin, onRemovePin }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { from, to } = FRUIT_HEX[profile.fruitColor]

  const hasMenu = onRename || onDelete || onSetPin || onChangePin || onRemovePin

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={`Open ${profile.name}`}
        onClick={() => onSelect(profile.id)}
        style={{
          appearance: 'none', cursor: 'pointer', border: 'none', background: 'rgba(255,250,240,0.95)',
          borderRadius: 18, padding: 20, width: 144, height: 144,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(60,20,10,0.28)',
          color: '#3c1810', fontWeight: 600,
        }}
      >
        <span
          style={{ position: 'relative', marginBottom: 10 }}
        >
          <span
            aria-hidden
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
              border: '2px solid rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 22,
              boxShadow: '0 3px 8px rgba(60,20,10,0.35), inset 0 -3px 6px rgba(0,0,0,0.2)',
            }}
          >
            {profile.avatarLetter}
          </span>
          {profile.pinRequired && (
            <span
              aria-label={`${profile.name} is locked`}
              style={{
                position: 'absolute', bottom: -3, right: -5,
                fontSize: 13, lineHeight: 1,
                background: 'rgba(255,250,240,0.95)',
                borderRadius: '50%',
                width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(60,20,10,0.3)',
              }}
            >
              <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 1 1 8 0v4" />
              </svg>
            </span>
          )}
        </span>
        <span style={{ fontSize: 14 }}>{profile.name}</span>
      </button>
      {hasMenu && (
        <>
          <button
            type="button"
            aria-label={`More options for ${profile.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            style={{
              position: 'absolute', top: 8, right: 8, width: 28, height: 28,
              border: 'none', background: 'transparent', cursor: 'pointer', color: '#3c1810',
              fontSize: 18, lineHeight: 1, borderRadius: 14,
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
              {!profile.pinRequired && onSetPin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onSetPin(profile.id) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                  Set PIN
                </button>
              )}
              {profile.pinRequired && onChangePin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onChangePin(profile.id) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                  Change PIN
                </button>
              )}
              {profile.pinRequired && onRemovePin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRemovePin(profile.id) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                  Remove PIN
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
