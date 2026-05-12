import { create } from 'zustand'
import {
  ipcDownloadOpenFile,
  ipcDownloadShowInFolder,
  onDownloadFinished,
  onDownloadRequested,
  type IpcDownloadFinished,
  type IpcDownloadRequested,
} from '~/ipc/downloads'

export type DownloadStatus = 'in-progress' | 'completed' | 'failed'

export interface DownloadItem {
  id: string
  url: string
  filename: string
  destination: string
  status: DownloadStatus
  startedAt: number
  finishedAt?: number
}

interface DownloadsState {
  downloads: DownloadItem[]
  panelOpen: boolean
  listening: boolean
  toggle: () => void
  open: () => void
  close: () => void
  clear: () => void
  showInFolder: (id: string) => Promise<void>
  openFile: (id: string) => Promise<void>
  initListeners: () => Promise<void>
  handleRequested: (payload: IpcDownloadRequested) => void
  handleFinished: (payload: IpcDownloadFinished) => void
}

export const useDownloadsStore = create<DownloadsState>()((set, get) => ({
  downloads: [],
  panelOpen: false,
  listening: false,

  toggle: () => set((s) => ({ panelOpen: !s.panelOpen })),
  open: () => set({ panelOpen: true }),
  close: () => set({ panelOpen: false }),
  clear: () => set({ downloads: [] }),

  showInFolder: async (id) => {
    const item = get().downloads.find((d) => d.id === id)
    if (!item) return
    try {
      await ipcDownloadShowInFolder(item.destination)
    } catch {
      /* tolerate */
    }
  },

  openFile: async (id) => {
    const item = get().downloads.find((d) => d.id === id)
    if (!item || item.status !== 'completed') return
    try {
      await ipcDownloadOpenFile(item.destination)
    } catch {
      /* tolerate */
    }
  },

  initListeners: async () => {
    if (get().listening) return
    set({ listening: true })
    await onDownloadRequested((p) => get().handleRequested(p))
    await onDownloadFinished((p) => get().handleFinished(p))
  },

  handleRequested: (payload) => {
    set((s) => ({
      downloads: [
        {
          id: payload.id,
          url: payload.url,
          filename: payload.filename,
          destination: payload.destination,
          status: 'in-progress',
          startedAt: Date.now(),
        },
        ...s.downloads,
      ],
      panelOpen: true,
    }))
  },

  handleFinished: (payload) => {
    set((s) => {
      // Match by destination path when available, else fall back to URL.
      const targetPath = payload.path ?? ''
      const downloads = s.downloads.map((d) => {
        const matches = targetPath
          ? d.destination === targetPath
          : d.url === payload.url
        if (!matches || d.status !== 'in-progress') return d
        return {
          ...d,
          status: payload.success ? ('completed' as const) : ('failed' as const),
          finishedAt: Date.now(),
          destination: payload.path ?? d.destination,
        }
      })
      return { downloads }
    })
  },
}))
