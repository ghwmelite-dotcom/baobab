import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface IpcTabInfo {
  id: string
  url: string
}

export interface IpcTabLoaded {
  id: string
  url: string
  title: string | null
}

export const ipcCreateTab = (
  id: string,
  url: string,
  incognito?: boolean,
): Promise<IpcTabInfo> =>
  invoke('create_tab', {
    windowLabel: getCurrentWindow().label,
    id,
    url,
    incognito: incognito ?? false,
  })

export const ipcCloseTab = (id: string): Promise<void> => invoke('close_tab', { id })

export const ipcShowTab = (id: string): Promise<void> =>
  invoke('show_tab', { windowLabel: getCurrentWindow().label, id })

export const ipcHideTab = (id: string): Promise<void> => invoke('hide_tab', { id })

// Hide every non-main child webview. Use when nothing should be visible —
// e.g., switching to about:blank or opening a full-canvas overlay.
export const ipcHideAllTabs = (): Promise<void> =>
  invoke('hide_all_tabs', { windowLabel: getCurrentWindow().label })

export const ipcNavigateTab = (id: string, url: string): Promise<void> =>
  invoke('navigate_tab', { id, url })

export const ipcListTabs = (): Promise<IpcTabInfo[]> =>
  invoke('list_tabs', { windowLabel: getCurrentWindow().label })

export const ipcTabGoBack = (tabId: string): Promise<void> =>
  invoke('tab_go_back', { tabId })

export const ipcTabGoForward = (tabId: string): Promise<void> =>
  invoke('tab_go_forward', { tabId })

export const onTabLoaded = (
  cb: (payload: IpcTabLoaded) => void,
): Promise<UnlistenFn> => listen<IpcTabLoaded>('tab://loaded', (e) => cb(e.payload))
