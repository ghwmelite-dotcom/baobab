import type { LowBandwidthMode } from '../types'

export interface NetworkSnapshot {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'
  saveData: boolean
}

const SLOW_TYPES = new Set(['slow-2g', '2g', '3g'])

export function shouldUseLowBandwidth(
  mode: LowBandwidthMode,
  snapshot: NetworkSnapshot,
): boolean {
  if (mode === 'on') return true
  if (mode === 'off') return false
  // mode === 'auto'
  return snapshot.saveData || SLOW_TYPES.has(snapshot.effectiveType)
}
