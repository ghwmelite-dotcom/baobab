import { countryFor } from './search-rank'
import type { BraveResult } from './brave'

const QUESTION_WORDS = new Set([
  'how', 'what', 'why', 'when', 'where', 'who', 'which', 'whose', 'whom',
])

export type BraveRawResult = BraveResult

export interface SiteCard {
  name: string
  logoUrl?: string
  url: string
  country?: string
  description: string
  sitelinks: Array<{ title: string; path: string; url: string }>
}

function hostnameOf(r: BraveRawResult): string {
  if (r.meta_url?.hostname) return r.meta_url.hostname
  try { return new URL(r.url).hostname.replace(/^www\./, '') } catch { return '' }
}

/** Heuristic intent detection. Navigational iff:
 *  - query has ≤ 2 tokens
 *  - no token is a question word
 *  - top result's host (sans TLD) contains query OR query contains host-stem */
export function detectIntent(
  query: string,
  topResult: BraveRawResult | null,
): 'navigational' | 'informational' {
  if (!topResult) return 'informational'
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 2) return 'informational'
  if (tokens.some((t) => QUESTION_WORDS.has(t))) return 'informational'

  const host = hostnameOf(topResult).toLowerCase().replace(/^www\./, '')
  const stem = host.split('.')[0]
  if (!stem) return 'informational'

  const q = tokens.join('').replace(/[^a-z0-9]/g, '')
  if (q.length === 0) return 'informational'
  if (stem.includes(q) || q.includes(stem)) return 'navigational'
  return 'informational'
}

/** Extract a site card from a Brave result. Returns null if the input is
 *  malformed. Brave doesn't surface sitelinks in the web results endpoint,
 *  so the sitelinks array will typically be empty. */
export function extractSiteCard(result: BraveRawResult): SiteCard | null {
  if (!result || !result.url) return null

  const host = hostnameOf(result)

  const name =
    result.profile?.long_name ||
    result.profile?.name ||
    result.title.split(/[-—|·]/)[0]?.trim() ||
    host

  const description = result.description || ''

  const logoUrl =
    result.profile?.img ||
    result.thumbnail?.src ||
    result.meta_url?.favicon ||
    undefined

  const country = countryFor(host) ?? undefined

  return { name, logoUrl, url: result.url, country, description, sitelinks: [] }
}
