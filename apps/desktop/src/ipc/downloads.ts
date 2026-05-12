import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface IpcDownloadRequested {
  id: string
  url: string
  filename: string
  destination: string
}

export interface IpcDownloadFinished {
  url: string
  path: string | null
  success: boolean
}

export const ipcDownloadShowInFolder = (path: string): Promise<void> =>
  invoke('download_show_in_folder', { path })

export const ipcDownloadOpenFile = (path: string): Promise<void> =>
  invoke('download_open_file', { path })

export const onDownloadRequested = (
  cb: (payload: IpcDownloadRequested) => void,
): Promise<UnlistenFn> => listen<IpcDownloadRequested>('download://requested', (e) => cb(e.payload))

export const onDownloadFinished = (
  cb: (payload: IpcDownloadFinished) => void,
): Promise<UnlistenFn> => listen<IpcDownloadFinished>('download://finished', (e) => cb(e.payload))
