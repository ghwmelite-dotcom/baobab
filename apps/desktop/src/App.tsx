import { useEffect } from 'react'
import { ThemeProvider } from '@baobab/ui'
import { motion } from '@baobab/brand'
import { ChromeShell } from './chrome/ChromeShell'
import { TabStrip } from './chrome/TabStrip'
import { Omnibar } from './chrome/Omnibar'
import { NewTabPage } from './chrome/NewTabPage'
import { Sidebar, SIDEBAR_WIDTH } from './ai/Sidebar'
import { ChatPanel } from './ai/ChatPanel'
import { ReaderPanel } from './reader/ReaderPanel'
import { OfflineList } from './offline/OfflineList'
import { HistoryPanel } from './history/HistoryPanel'
import { BookmarksBar } from './bookmarks/BookmarksBar'
import { BookmarksPanel } from './bookmarks/BookmarksPanel'
import { DownloadsPanel } from './downloads/DownloadsPanel'
import { useDownloadsStore } from './downloads/downloads.store'
import { SettingsScreen } from './settings/SettingsScreen'
import { useChromeShortcuts } from './chrome/useChromeShortcuts'
import { refreshResidency } from './state/health'
import { useTabsStore } from './state/tabs.store'
import { useAiStore } from './ai/ai.store'
import { ipcHideTab, ipcShowTab } from './ipc/tabs'
import { AuthGate } from './auth/AuthGate'
import { AuthScreen } from './auth/AuthScreen'
import { UpdateToast } from './updater/UpdateToast'

export function App() {
  useChromeShortcuts()
  useEffect(() => {
    void refreshResidency()
    void useTabsStore.getState().hydrate()
    void useDownloadsStore.getState().initListeners()
    const t = setInterval(() => void refreshResidency(), 60_000)
    return () => clearInterval(t)
  }, [])

  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const active = tabs.find((t) => t.id === activeId)
  const showNtp = !active || active.url === 'about:blank'

  // Sidebar push-aside: when the AI sidebar is open the canvas shrinks
  // horizontally instead of being overlaid. Overlays inside the canvas
  // (Reader, History, Settings, etc.) are positioned within this region.
  const sidebarOpen = useAiStore((s) => s.sidebarOpen)
  const canvasRight = sidebarOpen ? SIDEBAR_WIDTH : 0

  useEffect(() => {
    if (!activeId) return
    if (showNtp) {
      void ipcHideTab(activeId).catch(() => undefined)
    } else {
      void ipcShowTab(activeId).catch(() => undefined)
    }
  }, [showNtp, activeId])

  return (
    <ThemeProvider theme="dark">
      <AuthGate>
        <ChromeShell
          chromeBar={<TabStrip />}
          addressBar={<Omnibar />}
          bookmarksBar={<BookmarksBar />}
        >
          {/* Canvas reflows when the sidebar opens (push-aside layout). */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: canvasRight,
              transition: `right ${motion.sidebarSlideMs}ms ${motion.ease}`,
              overflow: 'hidden',
            }}
          >
            <AuthScreen />
            <SettingsScreen />
            <ReaderPanel />
            <HistoryPanel />
            <OfflineList />
            <BookmarksPanel />
            <DownloadsPanel />
            {showNtp ? <NewTabPage /> : null}
            <UpdateToast />
          </div>
          <Sidebar>
            <ChatPanel />
          </Sidebar>
        </ChromeShell>
      </AuthGate>
    </ThemeProvider>
  )
}
