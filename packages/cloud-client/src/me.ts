import type { BaobabClient } from './client'

// Sovereign Data Dashboard — inventory + export endpoints.
//
// Inventory is a tiny payload (six scalars) suitable for polling on each
// dashboard open. Export returns the full JSON body as a Blob so the
// caller can offer it as a download without buffering through string.
export interface Inventory {
  bookmarks: number
  history: number
  offline_articles: number
  offline_bytes: number
  account_created_at: number
  last_visit_at: number | null
}

export class MeClient {
  constructor(private readonly client: BaobabClient) {}

  inventory(): Promise<Inventory> {
    return this.client.getJson<Inventory>('/api/me/inventory')
  }

  async exportAll(): Promise<Blob> {
    const r = await this.client.request('/api/me/export', { method: 'GET' })
    if (!r.ok) throw new Error(`${r.status}`)
    return await r.blob()
  }
}
