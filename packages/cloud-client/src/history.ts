import type { BaobabClient } from './client'

export interface HistoryItem {
  id: string
  url: string
  title: string | null
  last_visited_at: number
  visit_count: number
}

export class HistoryClient {
  constructor(private readonly client: BaobabClient) {}

  list(opts: { q?: string; limit?: number; offset?: number } = {}): Promise<{ items: HistoryItem[] }> {
    const p = new URLSearchParams()
    if (opts.q) p.set('q', opts.q)
    if (opts.limit) p.set('limit', String(opts.limit))
    if (opts.offset) p.set('offset', String(opts.offset))
    return this.client.getJson(`/api/history${p.toString() ? '?' + p.toString() : ''}`)
  }
  record(url: string, title?: string): Promise<{ ok: true; id?: string; skipped?: boolean }> {
    return this.client.postJson('/api/history', { url, title })
  }
  async clear(): Promise<{ ok: true }> {
    const r = await this.client.request('/api/history', { method: 'DELETE' })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as { ok: true }
  }
  async remove(id: string): Promise<{ ok: true }> {
    const r = await this.client.request(`/api/history/${id}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as { ok: true }
  }
}
