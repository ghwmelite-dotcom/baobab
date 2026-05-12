import type { BaobabClient } from './client'

export interface Bookmark {
  id: string
  url: string
  title: string | null
  description: string | null
  folder_id: string | null
  favicon_url: string | null
  position: number
  created_at: number
}

export interface BookmarkFolder {
  id: string
  name: string
  parent_id: string | null
  position: number
}

export class BookmarksClient {
  constructor(private readonly client: BaobabClient) {}

  list(): Promise<{ folders: BookmarkFolder[]; bookmarks: Bookmark[] }> {
    return this.client.getJson('/api/bookmarks')
  }
  create(b: {
    url: string
    title?: string
    description?: string
    folder_id?: string
    favicon_url?: string
    position?: number
  }): Promise<{ ok: true; id: string }> {
    return this.client.postJson('/api/bookmarks', b)
  }
  async update(id: string, patch: Partial<Bookmark>): Promise<{ ok: true }> {
    const r = await this.client.request(`/api/bookmarks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as { ok: true }
  }
  async remove(id: string): Promise<{ ok: true }> {
    const r = await this.client.request(`/api/bookmarks/${id}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(`${r.status}`)
    return (await r.json()) as { ok: true }
  }
  createFolder(name: string, parent_id?: string, position?: number): Promise<{ ok: true; id: string }> {
    return this.client.postJson('/api/bookmarks/folders', { name, parent_id, position })
  }
}
