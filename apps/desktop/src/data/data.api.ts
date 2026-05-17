import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useDataStore } from './data.store'

interface UsagePayload {
  bytesUsed: number
  bytesSaved: number
}

let unlisten: UnlistenFn | null = null

export const dataApi = {
  setSlowMode: (on: boolean): Promise<void> => invoke('set_slow_mode', { on }),

  /** Idempotent. Call once per window. */
  initListeners: async (): Promise<void> => {
    if (unlisten) return
    unlisten = await listen<UsagePayload>('data://usage', (event) => {
      const { bytesUsed, bytesSaved } = event.payload
      useDataStore.getState().recordUsage(bytesUsed, bytesSaved)
    })
  },
}
