export interface PseEnv {
  GOOGLE_PSE_API_KEY: string
  GOOGLE_PSE_CX: string
}

export interface PseResult {
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

/** Google Programmable Search Engine (Custom Search JSON API).
 *  Returns up to `num` results (clamped to 1..10). Throws on non-2xx. */
export async function searchGoogle(
  env: PseEnv,
  query: string,
  num = 10,
): Promise<PseResult[]> {
  const clampedNum = Math.max(1, Math.min(10, num))
  const url = new URL('https://customsearch.googleapis.com/customsearch/v1')
  url.searchParams.set('key', env.GOOGLE_PSE_API_KEY)
  url.searchParams.set('cx', env.GOOGLE_PSE_CX)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(clampedNum))

  const resp = await fetch(url.toString())
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`PSE ${resp.status}: ${text.slice(0, 200)}`)
  }
  const json = (await resp.json()) as { items?: PseResult[] }
  return json.items ?? []
}
