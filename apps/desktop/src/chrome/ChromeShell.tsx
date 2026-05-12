import type { ReactNode } from 'react'

interface Props {
  titlebar: ReactNode
  tabStrip: ReactNode
  bookmarksBar?: ReactNode
  omnibar: ReactNode
  statusBar: ReactNode
  children: ReactNode
}

export function ChromeShell({
  titlebar,
  tabStrip,
  bookmarksBar,
  omnibar,
  statusBar,
  children,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--canvas)',
      }}
    >
      {titlebar}
      {tabStrip}
      {bookmarksBar}
      {omnibar}
      <main style={{ position: 'relative', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        {children}
      </main>
      {statusBar}
    </div>
  )
}
