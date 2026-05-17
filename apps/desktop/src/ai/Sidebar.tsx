import { useAiStore } from './ai.store'
import { motion } from '@baobab/brand'
import type { ReactNode } from 'react'

interface Props {
  children?: ReactNode
}

export const SIDEBAR_WIDTH = 380

export function Sidebar({ children }: Props) {
  const open = useAiStore((s) => s.sidebarOpen)
  return (
    <aside
      aria-hidden={!open}
      aria-label="AI sidebar"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: SIDEBAR_WIDTH,
        background: 'var(--surface-1)',
        borderLeft: '1px solid var(--border)',
        transform: open ? 'translateX(0)' : `translateX(${SIDEBAR_WIDTH}px)`,
        transition: `transform ${motion.sidebarSlideMs}ms ${motion.ease}`,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
      }}
    >
      {children ?? (
        <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
          ChatPanel mounts here in Task 7.
        </div>
      )}
    </aside>
  )
}
