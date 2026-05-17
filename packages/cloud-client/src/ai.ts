import type { BaobabClient } from './client'
import { parseSseStream } from './sse'

export interface ChatRequest {
  message: string
  model_id?: string
  conversation_id?: string
  page_context?: string
}

export interface SummarizeRequest {
  url: string
  html_content?: string
}

export interface SummarizeResponse {
  summary: string
  key_points: string[]
  est_read_time: number
  cached: boolean
}

export interface SearchCitation {
  name: string
  country: string
  url?: string
  type: 'scholar' | 'publication' | 'institution'
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
  country: string | null
  isAfrican: boolean
}

export interface SearchSiteCard {
  name: string
  logoUrl?: string
  url: string
  country?: string
  description: string
  sitelinks: Array<{ title: string; path: string; url: string }>
}

export interface SearchResponse {
  intent: 'navigational' | 'informational'
  query?: string
  answer: { en: string; bilingual?: { lang: string; text: string } } | null
  citations: SearchCitation[]
  results: SearchResult[]
  diversity: { sourceCount: number; countryCount: number; africanVoicePercent: number }
  siteCard?: SearchSiteCard
  meta: {
    cached: boolean
    pseQueriesRemainingToday: number
    fallbackMode?: 'ai-only' | 'quota-degraded'
    translateFailed?: boolean
  }
}

export interface SearchRequest {
  query: string
  context?: Array<{ query: string; answer: string }>
  targetLanguage?: 'yo' | 'sw' | 'ha' | 'ig' | 'am' | 'zu' | 'xh' | 'wo' | 'ak'
  source?: { url: string; title: string }
}

export interface BureaucracyResponse {
  answer: string
}

export class AiClient {
  constructor(private readonly client: BaobabClient) {}

  async *streamChat(req: ChatRequest): AsyncGenerator<{ token: string }, { conversationId: string }, void> {
    const r = await this.client.request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(req),
    })
    if (!r.ok) throw new Error(`/api/ai/chat ${r.status}`)
    const convId = r.headers.get('X-Conversation-Id') ?? ''
    if (!r.body) return { conversationId: convId }
    for await (const ev of parseSseStream(r.body)) {
      if (ev.kind === 'data' && typeof ev.json?.response === 'string') {
        yield { token: ev.json.response as string }
      } else if (ev.kind === 'done') {
        break
      }
    }
    return { conversationId: convId }
  }

  summarize(req: SummarizeRequest): Promise<SummarizeResponse> {
    return this.client.postJson('/api/ai/summarize', req)
  }
  async search(req: SearchRequest): Promise<SearchResponse> {
    const resp = await this.client.request('/api/search', {
      method: 'POST',
      body: JSON.stringify(req),
    })
    if (!resp.ok) throw new Error(`search ${resp.status}`)
    return resp.json() as Promise<SearchResponse>
  }
  // Vertical agents return a single complete answer rather than streaming.
  bureaucracy(query: string): Promise<BureaucracyResponse> {
    return this.client.postJson('/api/agents/bureaucracy', { query })
  }
}
