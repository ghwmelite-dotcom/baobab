import { invoke } from '@tauri-apps/api/core'

export interface IpcTabInfo {
  id: string
  url: string
}

export const ipcCreateTab = (id: string, url: string): Promise<IpcTabInfo> =>
  invoke('create_tab', { id, url })

export const ipcCloseTab = (id: string): Promise<void> => invoke('close_tab', { id })

export const ipcShowTab = (id: string): Promise<void> => invoke('show_tab', { id })

export const ipcHideTab = (id: string): Promise<void> => invoke('hide_tab', { id })

export const ipcNavigateTab = (id: string, url: string): Promise<void> =>
  invoke('navigate_tab', { id, url })

export const ipcListTabs = (): Promise<IpcTabInfo[]> => invoke('list_tabs')
