import { create } from 'zustand'

export type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'

interface NavigatorConnectionLike {
  effectiveType?: EffectiveType
  downlink?: number
  saveData?: boolean
  type?: string
  addEventListener?: (ev: string, cb: () => void) => void
  removeEventListener?: (ev: string, cb: () => void) => void
}

function readConnection(): NavigatorConnectionLike {
  const c = (navigator as Navigator & { connection?: NavigatorConnectionLike }).connection
  return c ?? {}
}

interface ConnectionState {
  effectiveType: EffectiveType
  downlinkMbps: number
  saveData: boolean
  type: string                  // 'wifi' | 'ethernet' | 'cellular' | etc., or '' if unknown
  isOffline: boolean
  isSlow: boolean
  slowModeForced: boolean
  sync: () => void
  isSlowEffective: () => boolean
  setForced: (forced: boolean) => void
}

function compute(c: NavigatorConnectionLike): { effectiveType: EffectiveType; downlinkMbps: number; saveData: boolean; type: string; isSlow: boolean } {
  const effectiveType = (c.effectiveType ?? 'unknown') as EffectiveType
  const downlinkMbps = typeof c.downlink === 'number' ? c.downlink : 0
  const saveData = c.saveData === true
  const type = typeof c.type === 'string' ? c.type : ''
  const isSlow =
    effectiveType === 'slow-2g' ||
    effectiveType === '2g' ||
    (downlinkMbps > 0 && downlinkMbps < 1.5) ||
    saveData
  return { effectiveType, downlinkMbps, saveData, type, isSlow }
}

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  effectiveType: 'unknown',
  downlinkMbps: 0,
  saveData: false,
  type: '',
  isOffline: false,
  isSlow: false,
  slowModeForced: false,

  sync: () => {
    const next = compute(readConnection())
    set({ ...next, isOffline: !navigator.onLine })
  },

  setForced: (forced) => set({ slowModeForced: forced }),

  isSlowEffective: () => {
    const s = get()
    return s.isSlow || s.slowModeForced
  },
}))

/** Attach listeners to navigator.connection + onLine/offline. Idempotent. */
let attached = false
export function attachConnectionListeners(): () => void {
  if (attached) return () => undefined
  attached = true
  const c = readConnection()
  const onChange = () => useConnectionStore.getState().sync()
  c.addEventListener?.('change', onChange)
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  useConnectionStore.getState().sync()
  return () => {
    c.removeEventListener?.('change', onChange)
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
    attached = false
  }
}
