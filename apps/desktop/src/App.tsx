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
import { TranslatePad } from './translate/TranslatePad'
import { useDownloadsStore } from './downloads/downloads.store'
import { useProfile } from './profiles/useProfile'
import { SettingsScreen } from './settings/SettingsScreen'
import { SovereigntyDashboard } from './sovereignty/SovereigntyDashboard'
import { useChromeShortcuts } from './chrome/useChromeShortcuts'
import { refreshResidency } from './state/health'
import { useTabsStore } from './state/tabs.store'
import { useAiStore } from './ai/ai.store'
import { ipcHideAllTabs, ipcShowTab } from './ipc/tabs'
import { AuthGate } from './auth/AuthGate'
import { AuthScreen } from './auth/AuthScreen'
import { useAuthStore } from './auth/auth.store'
import { useSettingsStore } from './settings/settings.store'
import { useReaderStore } from './reader/reader.store'
import { useHistoryStore } from './history/history.store'
import { useOfflineStore } from './offline/offline.store'
import { useBookmarksStore } from './bookmarks/bookmarks.store'
import { useSovereigntyDashboardStore } from './sovereignty/dashboard.store'
import { useTranslateStore } from './translate/translate.store'
import { usePaymentsStore } from './payments/payments.store'
import { UpdateToast } from './updater/UpdateToast'
import { PayWidget } from './payments/PayWidget'

export function App() {
  useChromeShortcuts()
  const profile = useProfile()

  // Wait for ProfileProvider to resolve before hydrating stores — they read
  // per-profile persistence keys and require setProfileId to have been called.
  // Firing hydrate() before setProfileId is set causes scope() to throw and
  // tabs never restore on cold start (the error is swallowed silently).
  useEffect(() => {
    if (!profile) return
    void useTabsStore.getState().hydrate()
    void useTabsStore.getState().initListeners()
    void useDownloadsStore.getState().initListeners()
  }, [profile?.id])

  useEffect(() => {
    void refreshResidency()
    const t = setInterval(() => void refreshResidency(), 60_000)
    return () => clearInterval(t)
  }, [])

  // Belt-and-braces with `overflow: clip` on html/body in globals.css.
  // Some focus / restoreFocus paths can shift document.scrollLeft to a
  // non-zero value (e.g. when the Sidebar is translateX'd off-screen).
  // We zero it on every render so the chrome layer always anchors at
  // the viewport's left edge.
  useEffect(() => {
    if (document.documentElement.scrollLeft !== 0) document.documentElement.scrollLeft = 0
    if (document.body.scrollLeft !== 0) document.body.scrollLeft = 0
  })

  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const active = tabs.find((t) => t.id === activeId)
  const showNtp = !active || active.url === 'about:blank'

  // Sidebar push-aside: when the AI sidebar is open the canvas shrinks
  // horizontally instead of being overlaid. Overlays inside the canvas
  // (Reader, History, Settings, etc.) are positioned within this region.
  const sidebarOpen = useAiStore((s) => s.sidebarOpen)
  const canvasRight = sidebarOpen ? SIDEBAR_WIDTH : 0

  // Tauri's child WebView2 windows are native HWNDs that always sit
  // above the React DOM. When ANY overlay opens (Settings, Reader,
  // History, etc.) we need to hide the active tab's webview, or the
  // overlay renders BEHIND the page content. Hide also fires when the
  // active tab is about:blank so the NewTabPage gradient shows
  // instead of a white WebView default.
  const settingsOpen = useSettingsStore((s) => s.open)
  const readerOpen = useReaderStore((s) => s.open)
  const historyOpen = useHistoryStore((s) => s.drawerOpen)
  const bookmarksOpen = useBookmarksStore((s) => s.drawerOpen)
  const offlineOpen = useOfflineStore((s) => s.drawerOpen)
  const authOverlayOpen = useAuthStore((s) => s.signInOverlayOpen)
  const sovereigntyOpen = useSovereigntyDashboardStore((s) => s.open)
  const translateOpen = useTranslateStore((s) => s.open)
  const paymentsOpen = usePaymentsStore((s) => s.widgetOpen)
  const downloadsOpen = useDownloadsStore((s) => s.panelOpen)
  const anyOverlayOpen =
    settingsOpen ||
    readerOpen ||
    historyOpen ||
    bookmarksOpen ||
    offlineOpen ||
    authOverlayOpen ||
    sovereigntyOpen ||
    translateOpen ||
    paymentsOpen ||
    downloadsOpen

  useEffect(() => {
    if (!activeId) return
    if (showNtp || anyOverlayOpen) {
      // Hide ALL webviews — hide_tab(activeId) alone leaves any
      // previously-shown tab's webview dangling on top of React when
      // the user switches to about:blank or opens an overlay.
      void ipcHideAllTabs().catch(() => undefined)
    } else {
      // show_tab already hides every other webview before showing the
      // target, so we only need to call it for the active tab.
      void ipcShowTab(activeId).catch(() => undefined)
    }
  }, [showNtp, activeId, anyOverlayOpen])

  if (!profile) {
    return <div style={{ padding: 24, color: 'rgba(255,255,255,0.7)' }}>Loading profile…</div>
  }

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
            <PayWidget />
            <SettingsScreen />
            <SovereigntyDashboard />
            <ReaderPanel />
            <HistoryPanel />
            <OfflineList />
            <BookmarksPanel />
            <DownloadsPanel />
            <TranslatePad />
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
