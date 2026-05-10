import { ThemeProvider } from '@baobab/ui'
import { ChromeShell } from './chrome/ChromeShell'
import { TitleBar } from './chrome/TitleBar'

export function App() {
  return (
    <ThemeProvider theme="dark">
      <ChromeShell
        titlebar={<TitleBar />}
        tabStrip={<div style={{ height: 40, background: 'var(--surface-2)' }} />}
        omnibar={<div style={{ height: 56, background: 'var(--surface-1)' }} />}
        statusBar={<div style={{ height: 28, background: 'var(--surface-1)' }} />}
      >
        <div style={{ padding: 24, color: 'var(--text-secondary)' }}>Page area</div>
      </ChromeShell>
    </ThemeProvider>
  )
}
