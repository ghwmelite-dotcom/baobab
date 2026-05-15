import { getCurrentWindow } from '@tauri-apps/api/window'

export function PickerControls() {
  const win = getCurrentWindow()

  return (
    <div
      data-tauri-drag-region="false"
      style={{
        position: 'absolute', top: 0, right: 0,
        display: 'flex', height: 36, zIndex: 50,
      }}
    >
      <CtrlButton aria-label="Minimize" onClick={() => void win.minimize()}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6 H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </CtrlButton>
      <CtrlButton aria-label="Maximize / restore" onClick={() => void win.toggleMaximize()}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="2.5" y="2.5" width="7" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </CtrlButton>
      <CtrlButton aria-label="Close" onClick={() => void win.close()} danger>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </CtrlButton>
    </div>
  )
}

function CtrlButton({
  children, onClick, danger, ...rest
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-tauri-drag-region="false"
      onClick={onClick}
      {...rest}
      style={{
        width: 46, height: 36,
        border: 'none', background: 'transparent', cursor: 'pointer',
        color: 'rgba(60,24,16,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms ease, color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? '#e81123' : 'rgba(60,24,16,0.08)'
        e.currentTarget.style.color = danger ? 'white' : '#3c1810'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'rgba(60,24,16,0.65)'
      }}
    >
      {children}
    </button>
  )
}
