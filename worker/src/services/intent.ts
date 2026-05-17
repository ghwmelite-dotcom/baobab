import { countryFor } from './search-rank'

const QUESTION_WORDS = new Set([
  'how', 'what', 'why', 'when', 'where', 'who', 'which', 'whose', 'whom',
])

export interface PseRawResult {
  title: string
  link: string
  displayLink: string
  snippet: string
  pagemap?: {
    metatags?: Array<Record<string, string>>
    cse_image?: Array<{ src: string }>
    sitelinks?: Array<{ url: string; title: string }>
  }
}

export interface SiteCard {
  name: string
  logoUrl?: string
  url: string
  country?: string
  description: string
  sitelinks: Array<{ title: string; path: string; url: string }>
}

/** Heuristic intent detection. Navigational iff:
 *  - query has ≤ 2 tokens
 *  - no token is a question word
 *  - top result's host (sans TLD) contains query OR query contains host-stem */
export function detectIntent(
  query: string,
  topResult: PseRawResult | null,
): 'navigational' | 'informational' {
  if (!topResult) return 'informational'
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 2) return 'informational'
  if (tokens.some((t) => QUESTION_WORDS.has(t))) return 'informational'

  const host = topResult.displayLink.toLowerCase().replace(/^www\./, '')
  const stem = host.split('.')[0]
  if (!stem) return 'informational'

  const q = tokens.join('').replace(/[^a-z0-9]/g, '')
  if (q.length === 0) return 'informational'
  if (stem.includes(q) || q.includes(stem)) return 'navigational'
  return 'informational'
}

/** Extract a site card from a PSE result. Returns null if the input is
 *  malformed. `sitelinks` may be empty when PSE didn't surface any. */
export function extractSiteCard(result: PseRawResult): SiteCard | null {
  if (!result || !result.link) return null

  const meta = result.pagemap?.metatags?.[0] ?? {}
  const name =
    meta['og:site_name'] ||
    meta['application-name'] ||
    result.title.split(/[-—|·]/)[0].trim() ||
    result.displayLink

  const description =
    meta['og:description'] || meta['description'] || result.snippet || ''

  const logoUrl =
    result.pagemap?.cse_image?.[0]?.src ||
    meta['og:image'] ||
    undefined

  const country = countryFor(result.displayLink) ?? undefined

  const sitelinks =
    (result.pagemap?.sitelinks ?? []).slice(0, 6).map((s) => {
      let path = '/'
      try { path = new URL(s.url).pathname } catch { /* keep '/' */ }
      return { title: s.title, path, url: s.url }
    })

  return { name, logoUrl, url: result.link, country, description, sitelinks }
}
