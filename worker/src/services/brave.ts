export interface BraveEnv {
  BRAVE_API_KEY: string
}

export interface BraveResult {
  title: string
  url: string
  description: string
  meta_url?: {
    scheme?: string
    netloc?: string
    hostname?: string
    favicon?: string
    path?: string
  }
  profile?: {
    name?: string
    url?: string
    long_name?: string
    img?: string
  }
  thumbnail?: { src?: string; original?: string }
  age?: string
  language?: string
  extra_snippets?: string[]
}

/** Brave Search API — web search. Returns up to `count` results (clamped to
 *  1..20). Auth via X-Subscription-Token header. Throws on non-2xx. */
export async function searchBrave(
  env: BraveEnv,
  query: string,
  count = 10,
): Promise<BraveResult[]> {
  const clampedCount = Math.max(1, Math.min(20, count))
  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(clampedCount))

  const resp = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': env.BRAVE_API_KEY,
    },
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Brave ${resp.status}: ${text.slice(0, 200)}`)
  }
  const json = (await resp.json()) as { web?: { results?: BraveResult[] } }
  return json.web?.results ?? []
}
