import { OS } from '~/platform/os'
import { strings } from '@baobab/brand'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { IconButton } from '@baobab/ui'

const win = () => getCurrentWindow()

function MinimizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
function MaximizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <rect x="2.5" y="2.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.5" />
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
        padding: isMac ? '0 12px 0 80px' : '0 0 0 12px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      <span
        data-tauri-drag-region
        style={{
          fontFamily: 'Recoleta, "General Sans", system-ui, sans-serif',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '0.01em',
        }}
      >
        {strings.appName}
      </span>
      {!isMac && (
        <div style={{ display: 'flex' }}>
          <IconButton aria-label="Minimize" onClick={() => void win().minimize()}>
            <MinimizeIcon />
          </IconButton>
          <IconButton aria-label="Maximize" onClick={() => void win().toggleMaximize()}>
            <MaximizeIcon />
          </IconButton>
          <IconButton
            aria-label="Close"
            onClick={() => void win().close()}
            style={{ color: 'var(--critical)' }}
          >
            <CloseIcon />
          </IconButton>
        </div>
      )}
    </header>
  )
}
