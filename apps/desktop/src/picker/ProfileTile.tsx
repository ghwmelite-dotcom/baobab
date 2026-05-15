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
  const [hovered, setHovered] = useState(false)
  const { from, to } = FRUIT_HEX[profile.fruitColor]

  const hasMenu = onRename || onDelete || onSetPin || onChangePin || onRemovePin

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        data-tauri-drag-region="false"
        aria-label={`Open ${profile.name}`}
        onClick={() => onSelect(profile.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          appearance: 'none', cursor: 'pointer', border: 'none',
          background: `linear-gradient(135deg, rgba(255,250,240,0.96), rgba(255,250,240,0.88)), radial-gradient(circle at 50% 0%, ${from}33, transparent 60%)`,
          backgroundBlendMode: 'normal',
          borderRadius: 20, padding: 20, width: 144, height: 144,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: hovered
            ? `0 12px 28px rgba(60,20,10,0.32), 0 0 0 1px ${from}55, 0 0 24px ${from}33`
            : '0 4px 14px rgba(60,20,10,0.28)',
          color: '#3c1810', fontWeight: 600,
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
          transition: 'transform 220ms cubic-bezier(0.16, 0.85, 0.45, 1), box-shadow 220ms ease',
          position: 'relative',
          overflow: 'visible',
        }}
      >
        {/* Subtle fruit-color halo behind avatar */}
        <span
          aria-hidden
          style={{
            position: 'absolute', top: 18, left: '50%',
            transform: `translateX(-50%) scale(${hovered ? 1.4 : 1.0})`,
            width: 60, height: 60, borderRadius: '50%',
            background: `radial-gradient(circle, ${from}66, transparent 70%)`,
            opacity: hovered ? 0.85 : 0.45,
            transition: 'transform 280ms ease, opacity 280ms ease',
            pointerEvents: 'none',
          }}
        />
        <span style={{ position: 'relative', marginBottom: 10, zIndex: 1 }}>
          <span
            aria-hidden
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `radial-gradient(circle at 30% 28%, ${from}, ${to})`,
              border: '2px solid rgba(255,255,255,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 23, fontWeight: 700,
              boxShadow: `0 4px 10px rgba(60,20,10,0.35), inset 0 -3px 8px rgba(0,0,0,0.22), inset 0 3px 6px rgba(255,255,255,0.35)`,
              transform: hovered ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 260ms cubic-bezier(0.16, 0.85, 0.45, 1)',
            }}
          >
            {profile.avatarLetter}
          </span>
          {profile.pinRequired && (
            <span
              aria-label={`${profile.name} is locked`}
              style={{
                position: 'absolute', bottom: -4, right: -6,
                background: 'linear-gradient(135deg, #3c1810, #1f0d05)',
                color: '#fde7c4',
                borderRadius: '50%',
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,250,240,0.95)',
              }}
            >
              <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 1 1 8 0v4" />
              </svg>
            </span>
          )}
        </span>
        <span style={{ fontSize: 14, zIndex: 1, position: 'relative', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile.name}
        </span>
      </button>
      {hasMenu && (
        <>
          <button
            type="button"
            data-tauri-drag-region="false"
            aria-label={`More options for ${profile.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
            style={{
              position: 'absolute', top: 8, right: 8, width: 28, height: 28,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'rgba(60,24,16,0.55)',
              fontSize: 18, lineHeight: 1, borderRadius: 14,
              transition: 'background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(60,24,16,0.10)'; e.currentTarget.style.color = '#3c1810' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(60,24,16,0.55)' }}
          >···</button>
          {menuOpen && (
            <div
              role="menu"
              data-tauri-drag-region="false"
              style={{
                position: 'absolute', top: 36, right: 6, background: 'white',
                borderRadius: 10, boxShadow: '0 10px 24px rgba(0,0,0,0.22), 0 0 0 1px rgba(60,24,16,0.06)',
                padding: 5, minWidth: 140, zIndex: 10,
                animation: 'bb-text-in 160ms ease both',
              }}
            >
              {onRename && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRename(profile.id) }}
                  style={menuItemStyle}>
                  Rename
                </button>
              )}
              {!profile.pinRequired && onSetPin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onSetPin(profile.id) }}
                  style={menuItemStyle}>
                  Set PIN
                </button>
              )}
              {profile.pinRequired && onChangePin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onChangePin(profile.id) }}
                  style={menuItemStyle}>
                  Change PIN
                </button>
              )}
              {profile.pinRequired && onRemovePin && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRemovePin(profile.id) }}
                  style={menuItemStyle}>
                  Remove PIN
                </button>
              )}
              {onDelete && (
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete(profile.id) }}
                  style={{ ...menuItemStyle, color: '#a23a1f' }}>
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

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '7px 12px', border: 'none', background: 'transparent',
  cursor: 'pointer', fontSize: 13, borderRadius: 6,
  transition: 'background 100ms ease',
}
