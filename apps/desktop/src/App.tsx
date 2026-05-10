import { ThemeProvider } from '@baobab/ui'
import { ChromeShell } from './chrome/ChromeShell'
import { TitleBar } from './chrome/TitleBar'
import { TabStrip } from './chrome/TabStrip'
import { Omnibar } from './chrome/Omnibar'
import { StatusBar } from './chrome/StatusBar'
import { useChromeShortcuts } from './chrome/useChromeShortcuts'

export function App() {
  useChromeShortcuts()
  return (
    <ThemeProvider theme="dark">
      <ChromeShell
        titlebar={<TitleBar />}
        tabStrip={<TabStrip />}
        omnibar={<Omnibar />}
        statusBar={<StatusBar />}
      >
        {null}
      </ChromeShell>
    </ThemeProvider>
  )
}
