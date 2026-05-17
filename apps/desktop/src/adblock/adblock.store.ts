import { create } from 'zustand'
import { adblockApi, type AdblockSource } from './adblock.api'

const COOLDOWN_MS = 60_000

interface AdblockState {
  enabled: boolean
  lastUpdated: string
  source: AdblockSource
  refreshing: boolean
  error: string | null
  lastRefreshAttempt: number

  hydrate: (profileId: string) => Promise<void>
  setEnabled: (profileId: string, enabled: boolean) => Promise<void>
  refresh: () => Promise<void>
}

export const useAdblockStore = create<AdblockState>((set, get) => ({
  enabled: true,
  lastUpdated: '',
  source: { kind: 'Bundled' },
  refreshing: false,
  error: null,
  lastRefreshAttempt: 0,

  hydrate: async (profileId) => {
    try {
      const s = await adblockApi.getState(profileId)
      set({
        enabled: s.enabled,
        lastUpdated: s.lastUpdated,
        source: s.source,
        error: null,
      })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    }
  },

  setEnabled: async (profileId, enabled) => {
    await adblockApi.setEnabled(profileId, enabled)
    set({ enabled })
  },

  refresh: async () => {
    const now = Date.now()
    if (now - get().lastRefreshAttempt < COOLDOWN_MS) return
    set({ refreshing: true, error: null, lastRefreshAttempt: now })
    try {
      const s = await adblockApi.refreshLists()
      set({
        lastUpdated: s.lastUpdated,
        source: s.source,
        refreshing: false,
      })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : String(e),
        refreshing: false,
      })
    }
  },
}))
