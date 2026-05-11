// Initial seed of African news/gov sources. Expanded via KV at runtime.
export const AFRICAN_SOURCES_SEED: Record<string, number> = {
  'premiumtimesng.com': 1.0,
  'dailygraphic.com.gh': 1.0,
  'graphic.com.gh': 1.0,
  'citinewsroom.com': 1.0,
  'myjoyonline.com': 1.0,
  'pulse.ng': 1.0,
  'vanguardngr.com': 1.0,
  'thisdaylive.com': 1.0,
  'punchng.com': 1.0,
  'nation.africa': 1.0,
  'standardmedia.co.ke': 1.0,
  'capitalfm.co.ke': 1.0,
  'theeastafrican.co.ke': 1.0,
  'dailymaverick.co.za': 1.0,
  'iol.co.za': 1.0,
  'businesslive.co.za': 1.0,
  'news24.com': 1.0,
  'mg.co.za': 1.0,
  'continent.substack.com': 1.0,
  'africa.businessinsider.com': 0.9,
  'africanews.com': 1.0,
  'al-monitor.com': 0.9,
  'ahram.org.eg': 1.0,
  'dailynewsegypt.com': 1.0,
  'gov.gh': 1.0,
  'gov.ng': 1.0,
  'gov.ke': 1.0,
  'gov.za': 1.0,
  'au.int': 1.0,
  'ecowas.int': 1.0,
}

export function scoreUrl(url: string, allowlist: Record<string, number>): number {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    for (const [domain, score] of Object.entries(allowlist)) {
      if (host === domain || host.endsWith(`.${domain}`)) return score
    }
  } catch { /* invalid url */ }
  return 0.7
}

export function rerank<T extends { url: string }>(items: T[], allowlist: Record<string, number>): T[] {
  return [...items].sort((a, b) => scoreUrl(b.url, allowlist) - scoreUrl(a.url, allowlist))
}
