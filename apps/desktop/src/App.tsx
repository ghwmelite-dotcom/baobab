import { ThemeProvider } from '@baobab/ui'
import { ChromeShell } from './chrome/ChromeShell'
import { TitleBar } from './chrome/TitleBar'
import { TabStrip } from './chrome/TabStrip'

export function App() {
  return (
    <ThemeProvider theme="dark">
      <ChromeShell
        titlebar={<TitleBar />}
        tabStrip={<TabStrip />}
        omnibar={<div style={{ height: 56, background: 'var(--surface-1)' }} />}
        statusBar={<div style={{ height: 28, background: 'var(--surface-1)' }} />}
      >
        {null}
      </ChromeShell>
    </ThemeProvider>
  )
}
