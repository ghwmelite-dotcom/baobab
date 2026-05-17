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

// ISO-3166 alpha-2 mapping for TLDs and curated domains. Drives the country
// flag emoji in the result list and the source-diversity meter's country count.
export const AFRICAN_TLDS = new Set<string>([
  '.ng', '.ke', '.za', '.gh', '.et', '.tz', '.ug', '.zw', '.ci', '.sn',
  '.ml', '.ma', '.eg', '.dz', '.mz', '.cm', '.rw', '.ao', '.ly', '.tn',
  '.bw', '.zm', '.mw', '.bj', '.bf', '.gn', '.ne', '.td', '.cd', '.cg',
  '.mg', '.mu', '.na', '.sc', '.sd', '.so', '.sl', '.ss', '.lr', '.ga',
])

const TLD_TO_ISO: Record<string, string> = {
  '.ng': 'NG', '.ke': 'KE', '.za': 'ZA', '.gh': 'GH', '.et': 'ET',
  '.tz': 'TZ', '.ug': 'UG', '.zw': 'ZW', '.ci': 'CI', '.sn': 'SN',
  '.ml': 'ML', '.ma': 'MA', '.eg': 'EG', '.dz': 'DZ', '.mz': 'MZ',
  '.cm': 'CM', '.rw': 'RW', '.ao': 'AO', '.ly': 'LY', '.tn': 'TN',
  '.bw': 'BW', '.zm': 'ZM', '.mw': 'MW', '.bj': 'BJ', '.bf': 'BF',
  '.gn': 'GN', '.ne': 'NE', '.td': 'TD', '.cd': 'CD', '.cg': 'CG',
  '.mg': 'MG', '.mu': 'MU', '.na': 'NA', '.sc': 'SC', '.sd': 'SD',
  '.so': 'SO', '.sl': 'SL', '.ss': 'SS', '.lr': 'LR', '.ga': 'GA',
}

// Curated host → ISO country for domains where the TLD doesn't tell the
// truth (e.g. .com domains run by African publications).
const HOST_TO_ISO: Record<string, string> = {
  'premiumtimesng.com': 'NG', 'vanguardngr.com': 'NG', 'thisdaylive.com': 'NG',
  'pulse.ng': 'NG', 'punchng.com': 'NG', 'techcabal.com': 'NG',
  'dailygraphic.com.gh': 'GH', 'graphic.com.gh': 'GH',
  'citinewsroom.com': 'GH', 'myjoyonline.com': 'GH',
  'nation.africa': 'KE', 'standardmedia.co.ke': 'KE',
  'capitalfm.co.ke': 'KE', 'theeastafrican.co.ke': 'KE',
  'dailymaverick.co.za': 'ZA', 'iol.co.za': 'ZA',
  'businesslive.co.za': 'ZA', 'news24.com': 'ZA',
  'mg.co.za': 'ZA', 'ventureburn.com': 'ZA',
  'continent.substack.com': 'ZA',
  'africa.businessinsider.com': 'PAN', 'africanews.com': 'PAN',
  'theafricareport.com': 'PAN',
  'ahram.org.eg': 'EG', 'dailynewsegypt.com': 'EG',
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

/** Returns ISO-3166 alpha-2 country code (or 'PAN' for pan-African) for a
 *  host, or null when we have no opinion. */
export function countryFor(host: string): string | null {
  const norm = normalizeHost(host)
  if (HOST_TO_ISO[norm]) return HOST_TO_ISO[norm]
  for (const [domain, iso] of Object.entries(HOST_TO_ISO)) {
    if (norm.endsWith(`.${domain}`)) return iso
  }
  for (const tld of AFRICAN_TLDS) {
    if (norm.endsWith(tld)) return TLD_TO_ISO[tld] ?? null
  }
  return null
}

export function isAfrican(host: string): boolean {
  return countryFor(host) !== null
}
