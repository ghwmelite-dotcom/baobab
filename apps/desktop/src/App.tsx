import { useEffect } from 'react'
import { ThemeProvider } from '@baobab/ui'
import { ChromeShell } from './chrome/ChromeShell'
import { TitleBar } from './chrome/TitleBar'
import { TabStrip } from './chrome/TabStrip'
import { Omnibar } from './chrome/Omnibar'
import { StatusBar } from './chrome/StatusBar'
import { NewTabPage } from './chrome/NewTabPage'
import { useChromeShortcuts } from './chrome/useChromeShortcuts'
import { refreshResidency } from './state/health'
import { useTabsStore } from './state/tabs.store'
import { ipcHideTab } from './ipc/tabs'

export function App() {
  useChromeShortcuts()
  useEffect(() => {
    void refreshResidency()
    const t = setInterval(() => void refreshResidency(), 60_000)
    return () => clearInterval(t)
  }, [])

  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const active = tabs.find((t) => t.id === activeId)
  const showNtp = !active || active.url === 'about:blank'

  useEffect(() => {
    if (showNtp && activeId) {
      void ipcHideTab(activeId).catch(() => undefined)
    }
  }, [showNtp, activeId])

  return (
    <ThemeProvider theme="dark">
      <ChromeShell
        titlebar={<TitleBar />}
        tabStrip={<TabStrip />}
        omnibar={<Omnibar />}
        statusBar={<StatusBar />}
      >
        {showNtp ? <NewTabPage /> : null}
      </ChromeShell>
    </ThemeProvider>
  )
}
