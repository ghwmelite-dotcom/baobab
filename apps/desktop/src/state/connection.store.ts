import { create } from 'zustand'

export type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'

export type SlowModeOverride = 'auto' | 'always' | 'never'

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
  type: string
  isOffline: boolean
  isSlow: boolean
  slowModeOverride: SlowModeOverride
  sync: () => void
  isSlowEffective: () => boolean
  setOverride: (override: SlowModeOverride) => void
}

function compute(c: NavigatorConnectionLike): { effectiveType: EffectiveType; downlinkMbps: number; saveData: boolean; type: string; isSlow: boolean } {
  const effectiveType = (c.effectiveType ?? 'unknown') as EffectiveType
  const downlinkMbps = typeof c.downlink === 'number' ? c.downlink : 0
  const saveData = c.saveData === true
  const type = typeof c.type === 'string' ? c.type : ''
  // WebView2 reports `saveData` and `downlink` unreliably vs Chrome. Trust only
  // genuinely-slow effectiveType labels — the user can force on/off via Settings.
  const isSlow = effectiveType === 'slow-2g' || effectiveType === '2g'
  return { effectiveType, downlinkMbps, saveData, type, isSlow }
}

const initialIsOffline =
  typeof navigator !== 'undefined' ? !navigator.onLine : false

export const useConnectionStore = create<ConnectionState>()((set, get) => ({
  effectiveType: 'unknown',
  downlinkMbps: 0,
  saveData: false,
  type: '',
  isOffline: initialIsOffline,
  isSlow: false,
  slowModeOverride: 'auto',

  sync: () => {
    const next = compute(readConnection())
    set({ ...next, isOffline: !navigator.onLine })
  },

  setOverride: (override) => set({ slowModeOverride: override }),

  isSlowEffective: () => {
    const s = get()
    if (s.slowModeOverride === 'always') return true
    if (s.slowModeOverride === 'never') return false
    return s.isSlow
  },
}))

/** Attach listeners to navigator.connection + onLine/offline. Idempotent. */
let attached = false
export function attachConnectionListeners(): () => void {
  if (attached) return () => {}
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

/**
 * @internal Test-only hygiene helper. Resets module-level `attached` flag so
 * tests that exercise `attachConnectionListeners()` don't pollute each other.
 */
export function __resetConnectionListenersForTest(): void {
  attached = false
}
