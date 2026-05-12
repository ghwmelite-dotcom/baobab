import { client } from '~/auth/api'

export interface ReaderArticle {
  url: string
  title: string
  cleaned_html: string
  text: string
  word_count: number
  est_read_minutes: number
  ads_blocked: number
  trackers_blocked: number
  ai_summary: string
  key_points: string[]
  cached: boolean
}

export async function fetchReader(url: string): Promise<ReaderArticle> {
  const out = await client.postJson<Omit<ReaderArticle, 'url'>>('/api/proxy/fetch', { url })
  return { url, ...out }
}
