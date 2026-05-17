import { useConnectionStore } from '~/state/connection.store'

let wifiOnlySync = true

export function setWifiOnlySync(on: boolean): void {
  wifiOnlySync = on
}

export function isWifiOnlySync(): boolean {
  return wifiOnlySync
}

/**
 * If wifiOnlySync is enabled AND the connection isn't Wi-Fi-class, short-circuit
 * with `null` instead of invoking `fn`. Caller treats `null` as "deferred."
 *
 * Wi-Fi-class = navigator.connection.type === 'wifi' / 'ethernet', OR (when
 * type is unknown) effectiveType === '4g'. Cellular detection in the browser
 * is imperfect; the 4g fallback is a pragmatic compromise documented in the spec.
 */
export async function gate<T>(fn: () => Promise<T>): Promise<T | null> {
  if (!wifiOnlySync) return fn()
  const c = useConnectionStore.getState()
  const t = c.type
  const wifiClass = t === 'wifi' || t === 'ethernet' || (t === '' && c.effectiveType === '4g')
  if (!wifiClass) return null
  return fn()
}
