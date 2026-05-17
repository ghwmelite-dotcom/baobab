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

export interface SearchRequest {
  query: string
}

export interface SearchResponse {
  answer: string
  results: Array<{ title: string; url: string }>
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
  search(req: SearchRequest): Promise<SearchResponse> {
    return this.client.postJson('/api/ai/search', req)
  }
  // Vertical agents return a single complete answer rather than streaming.
  bureaucracy(query: string): Promise<BureaucracyResponse> {
    return this.client.postJson('/api/agents/bureaucracy', { query })
  }
}
