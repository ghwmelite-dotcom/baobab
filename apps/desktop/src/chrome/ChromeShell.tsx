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
      {/* `overflow: clip` (not `hidden`) — `hidden` permits the browser
          to set scrollLeft programmatically when focus moves to an
          off-viewport element (the Sidebar is translateX(380px) when
          closed, and focus-restore pulls it into view by scrolling
          <main> rightward by exactly SIDEBAR_WIDTH). That stale
          scrollLeft made every absolute-positioned child of <main>
          appear shifted left by 380px, hiding the NewTabPage wordmark.
          `clip` blocks both manual AND programmatic scrolling. */}
      <main style={{ position: 'relative', overflow: 'clip', flex: 1, minHeight: 0 }}>
        {children}
      </main>
    </div>
  )
}
