import type { CSSProperties, ReactNode } from 'react'
import { OS } from '~/platform/os'
import { strings } from '@baobab/brand'
import { getCurrentWindow } from '@tauri-apps/api/window'

const win = () => getCurrentWindow()

// Native-Windows-like compact control: 46×32 hit area (matches WIN10/11 chrome).
// Glyphs centered, hover background lifts subtly, close goes red on hover.
const baseCtrl: CSSProperties = {
  width: 46,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background 120ms ease, color 120ms ease',
}

function CtrlButton({
  label,
  onClick,
  hoverBg = 'rgba(255,255,255,0.06)',
  hoverColor = 'var(--text-primary)',
  children,
}: {
  label: string
  onClick: () => void
  hoverBg?: string
  hoverColor?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={baseCtrl}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = hoverBg
        ;(e.currentTarget as HTMLButtonElement).style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
      }}
      onFocus={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = hoverBg
      }}
      onBlur={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function MinimizeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
      <line x1="1.5" y1="5.5" x2="9.5" y2="5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  )
}
function MaximizeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
      <rect x="1.5" y="1.5" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
      <path d="M1.6 1.6 L9.4 9.4 M9.4 1.6 L1.6 9.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function TitleBar() {
  const isMac = OS === 'macos'
  return (
    <header
      data-tauri-drag-region
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMac ? '0 12px 0 80px' : '0 0 0 14px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      {/* Wordmark — Bookman Old Style, warm transitional serif. */}
      <span
        data-tauri-drag-region
        style={{
          fontFamily: 'var(--font-default)',
          fontWeight: 600,
          fontSize: 13.5,
          color: 'var(--text-primary)',
          letterSpacing: '0.005em',
        }}
      >
        {strings.appName}
      </span>

      {!isMac && (
        <div data-tauri-drag-region style={{ display: 'flex' }} aria-label="Window controls">
          <CtrlButton label="Minimize" onClick={() => void win().minimize()}>
            <MinimizeIcon />
          </CtrlButton>
          <CtrlButton label="Maximize" onClick={() => void win().toggleMaximize()}>
            <MaximizeIcon />
          </CtrlButton>
          <CtrlButton
            label="Close"
            onClick={() => void win().close()}
            hoverBg="rgba(185, 28, 28, 0.85)"
            hoverColor="#fff"
          >
            <CloseIcon />
          </CtrlButton>
        </div>
      )}
    </header>
  )
}
