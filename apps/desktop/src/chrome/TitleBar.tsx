import { OS } from '~/platform/os'
import { strings } from '@baobab/brand'
import type { ReactNode } from 'react'

interface Props {
  /** Optional right-side controls (settings, profile) */
  rightControls?: ReactNode
}

// macOS uses native traffic lights — render a transparent drag region only.
// Windows/Linux render a thin custom titlebar with wordmark.
export function TitleBar({ rightControls }: Props) {
  const isMac = OS === 'macos'
  return (
    <header
      data-tauri-drag-region
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMac ? '0 12px 0 80px' : '0 12px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      <span
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
      <div style={{ display: 'flex', gap: 4 }}>{rightControls}</div>
    </header>
  )
}
