import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/ipc/downloads', () => ({
  ipcDownloadShowInFolder: vi.fn(async () => undefined),
  ipcDownloadOpenFile: vi.fn(async () => undefined),
  onDownloadRequested: vi.fn(async () => () => undefined),
  onDownloadFinished: vi.fn(async () => () => undefined),
}))

import { useDownloadsStore } from '~/downloads/downloads.store'
import * as ipc from '~/ipc/downloads'

beforeEach(() => {
  useDownloadsStore.setState({ downloads: [], panelOpen: false, listening: false })
  vi.clearAllMocks()
})

describe('downloads store', () => {
  it('toggle flips panelOpen', () => {
    expect(useDownloadsStore.getState().panelOpen).toBe(false)
    useDownloadsStore.getState().toggle()
    expect(useDownloadsStore.getState().panelOpen).toBe(true)
    useDownloadsStore.getState().toggle()
    expect(useDownloadsStore.getState().panelOpen).toBe(false)
  })

  it('handleRequested adds an in-progress item and opens the panel', () => {
    useDownloadsStore.getState().handleRequested({
      id: 'd1',
      url: 'https://example.com/file.pdf',
      filename: 'file.pdf',
      destination: 'C:/Users/USER/Downloads/file.pdf',
    })
    const state = useDownloadsStore.getState()
    expect(state.downloads).toHaveLength(1)
    expect(state.downloads[0]?.status).toBe('in-progress')
    expect(state.downloads[0]?.filename).toBe('file.pdf')
    expect(state.panelOpen).toBe(true)
  })

  it('handleFinished flips matching item to completed', () => {
    useDownloadsStore.getState().handleRequested({
      id: 'd1',
      url: 'https://example.com/file.pdf',
      filename: 'file.pdf',
      destination: 'C:/Users/USER/Downloads/file.pdf',
    })
    useDownloadsStore.getState().handleFinished({
      url: 'https://example.com/file.pdf',
      path: 'C:/Users/USER/Downloads/file.pdf',
      success: true,
    })
    const item = useDownloadsStore.getState().downloads[0]
    expect(item?.status).toBe('completed')
    expect(item?.finishedAt).toBeTypeOf('number')
  })

  it('handleFinished with success:false flips to failed', () => {
    useDownloadsStore.getState().handleRequested({
      id: 'd2',
      url: 'https://example.com/big.zip',
      filename: 'big.zip',
      destination: 'C:/Users/USER/Downloads/big.zip',
    })
    useDownloadsStore.getState().handleFinished({
      url: 'https://example.com/big.zip',
      path: 'C:/Users/USER/Downloads/big.zip',
      success: false,
    })
    expect(useDownloadsStore.getState().downloads[0]?.status).toBe('failed')
  })

  it('falls back to URL match when finished path is null', () => {
    useDownloadsStore.getState().handleRequested({
      id: 'd3',
      url: 'https://example.com/a.bin',
      filename: 'a.bin',
      destination: 'C:/Users/USER/Downloads/a.bin',
    })
    useDownloadsStore.getState().handleFinished({
      url: 'https://example.com/a.bin',
      path: null,
      success: true,
    })
    expect(useDownloadsStore.getState().downloads[0]?.status).toBe('completed')
  })

  it('showInFolder invokes the IPC binding with the destination path', async () => {
    useDownloadsStore.getState().handleRequested({
      id: 'd4',
      url: 'https://example.com/x.bin',
      filename: 'x.bin',
      destination: 'C:/Users/USER/Downloads/x.bin',
    })
    await useDownloadsStore.getState().showInFolder('d4')
    expect(ipc.ipcDownloadShowInFolder).toHaveBeenCalledWith('C:/Users/USER/Downloads/x.bin')
  })

  it('openFile only fires for completed downloads', async () => {
    useDownloadsStore.getState().handleRequested({
      id: 'd5',
      url: 'https://example.com/y.bin',
      filename: 'y.bin',
      destination: 'C:/Users/USER/Downloads/y.bin',
    })
    await useDownloadsStore.getState().openFile('d5')
    expect(ipc.ipcDownloadOpenFile).not.toHaveBeenCalled()
    useDownloadsStore.getState().handleFinished({
      url: 'https://example.com/y.bin',
      path: 'C:/Users/USER/Downloads/y.bin',
      success: true,
    })
    await useDownloadsStore.getState().openFile('d5')
    expect(ipc.ipcDownloadOpenFile).toHaveBeenCalledOnce()
  })

  it('initListeners is idempotent', async () => {
    await useDownloadsStore.getState().initListeners()
    await useDownloadsStore.getState().initListeners()
    expect(ipc.onDownloadRequested).toHaveBeenCalledTimes(1)
    expect(ipc.onDownloadFinished).toHaveBeenCalledTimes(1)
  })

  it('clear empties the list', () => {
    useDownloadsStore.getState().handleRequested({
      id: 'd6',
      url: 'https://example.com/z.bin',
      filename: 'z.bin',
      destination: 'C:/z.bin',
    })
    expect(useDownloadsStore.getState().downloads).toHaveLength(1)
    useDownloadsStore.getState().clear()
    expect(useDownloadsStore.getState().downloads).toHaveLength(0)
  })
})
