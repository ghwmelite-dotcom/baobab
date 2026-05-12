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
        display: 'grid',
        gridTemplateRows: bookmarksBar
          ? 'auto auto auto auto 1fr auto'
          : 'auto auto auto 1fr auto',
        height: '100vh',
        background: 'var(--canvas)',
      }}
    >
      {titlebar}
      {tabStrip}
      {bookmarksBar}
      {omnibar}
      <main style={{ position: 'relative', overflow: 'hidden' }}>{children}</main>
      {statusBar}
    </div>
  )
}
