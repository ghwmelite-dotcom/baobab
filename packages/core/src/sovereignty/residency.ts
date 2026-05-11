import type { Residency } from '../types'

export function parseResidencyHeaders(headers: Headers): Residency {
  const colo = headers.get('X-Baobab-Colo') ?? 'unknown'
  const rawRegion = headers.get('X-Baobab-Region') ?? 'unknown'
  const region: Residency['region'] =
    rawRegion === 'africa' || rawRegion === 'edge-fallback' ? rawRegion : 'unknown'
  const dataResidency = headers.get('X-Data-Residency') ?? ''
  return { colo, region, dataResidency }
}
