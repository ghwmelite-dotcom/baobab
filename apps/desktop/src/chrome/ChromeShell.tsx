import type { ReactNode } from 'react'

interface Props {
  chromeBar: ReactNode
  addressBar: ReactNode
  bookmarksBar?: ReactNode
  children: ReactNode
}

export function ChromeShell({ chromeBar, addressBar, bookmarksBar, children }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--canvas)',
      }}
    >
      {chromeBar}
      {addressBar}
      {bookmarksBar}
      <main style={{ position: 'relative', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        {children}
      </main>
    </div>
  )
}
