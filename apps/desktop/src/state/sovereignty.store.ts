import { create } from 'zustand'
import type { LowBandwidthMode, Residency } from '@baobab/core'

interface SovereigntyState {
  residency: Residency
  lowBwMode: LowBandwidthMode
  adsBlocked: number
  pageLoadMs: number | null
  setResidency: (r: Residency) => void
  setLowBwMode: (m: LowBandwidthMode) => void
  bumpAdsBlocked: (n: number) => void
  setPageLoadMs: (ms: number | null) => void
}

export const useSovereigntyStore = create<SovereigntyState>()((set) => ({
  residency: { colo: 'unknown', region: 'unknown', dataResidency: '' },
  lowBwMode: 'auto',
  adsBlocked: 0,
  pageLoadMs: null,
  setResidency: (residency) => set({ residency }),
  setLowBwMode: (lowBwMode) => set({ lowBwMode }),
  bumpAdsBlocked: (n) => set((s) => ({ adsBlocked: s.adsBlocked + n })),
  setPageLoadMs: (pageLoadMs) => set({ pageLoadMs }),
}))
