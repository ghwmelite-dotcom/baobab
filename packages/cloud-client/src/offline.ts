import type { BaobabClient } from './client'

export interface OfflineArticle {
  id: string
  url: string
  title: string | null
  ai_summary: string | null
  word_count: number
  est_read_minutes: number
  saved_at: number
  read_at: number | null
  cleaned_html?: string
}

export interface SaveOfflineRequest {
  url: string
  title?: string
  cleaned_html: string
  ai_summary?: string
  word_count: number
  est_read_minutes: number
}

export class OfflineClient {
  constructor(private readonly client: BaobabClient) {}

  save(req: SaveOfflineRequest): Promise<{ ok: true; id: string; r2_key: string }> {
    return this.client.postJson('/api/offline/save', req)
  }
  list(unread = false): Promise<{ items: OfflineArticle[] }> {
    return this.client.getJson(`/api/offline${unread ? '?unread=1' : ''}`)
  }
  get(id: string): Promise<OfflineArticle> {
    return this.client.getJson(`/api/offline/${id}`)
  }
  markRead(id: string): Promise<{ ok: true }> {
    return this.client.postJson(`/api/offline/${id}/read`, {})
  }
  async delete(id: string): Promise<{ ok: true }> {
    const r = await this.client.request(`/api/offline/${id}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as { ok: true }
  }
}
