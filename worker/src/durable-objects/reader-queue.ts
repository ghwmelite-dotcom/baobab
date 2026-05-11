import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types'

interface SavedArticle {
  id: string
  user_id: string
  url: string
  title: string | null
  r2_key: string
  ai_summary: string | null
  word_count: number
  est_read_minutes: number
  saved_at: number
  read_at: number | null
  size_bytes: number
  // Index signature required so SqlStorage<T>.exec() accepts this as a row
  // shape — its constraint is Record<string, SqlStorageValue>.
  [key: string]: string | number | null
}

// Per-user offline reader queue. Each DO instance is keyed by user id and owns
// the article index for that user; bodies live in the OFFLINE R2 bucket and
// the SQLite table tracks metadata + read state. The route layer
// (/api/offline-articles, Task 37) is responsible for stub id generation, R2
// uploads, and dispatching here via env.READER_QUEUE.
export class ReaderQueue extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        r2_key TEXT NOT NULL,
        ai_summary TEXT,
        word_count INTEGER,
        est_read_minutes INTEGER,
        saved_at INTEGER,
        read_at INTEGER,
        size_bytes INTEGER
      )
    `)
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname
    const sql = this.ctx.storage.sql

    if (req.method === 'POST' && path === '/save') {
      const body = await req.json() as Omit<SavedArticle, 'saved_at' | 'read_at'> & { saved_at?: number }
      sql.exec(
        'INSERT INTO articles (id, user_id, url, title, r2_key, ai_summary, word_count, est_read_minutes, saved_at, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        body.id,
        body.user_id,
        body.url,
        body.title,
        body.r2_key,
        body.ai_summary,
        body.word_count,
        body.est_read_minutes,
        body.saved_at ?? Math.floor(Date.now() / 1000),
        body.size_bytes,
      )
      return Response.json({ ok: true })
    }

    if (req.method === 'GET' && path === '/list') {
      const userId = url.searchParams.get('user_id')
      const unread = url.searchParams.get('unread') === '1'
      const cursor = sql.exec<SavedArticle>(
        unread
          ? 'SELECT * FROM articles WHERE user_id = ? AND read_at IS NULL ORDER BY saved_at DESC'
          : 'SELECT * FROM articles WHERE user_id = ? ORDER BY saved_at DESC',
        userId,
      )
      return Response.json({ items: [...cursor] })
    }

    if (req.method === 'POST' && path === '/mark-read') {
      const { id, user_id } = await req.json() as { id: string; user_id: string }
      sql.exec(
        'UPDATE articles SET read_at = ? WHERE id = ? AND user_id = ?',
        Math.floor(Date.now() / 1000),
        id,
        user_id,
      )
      return Response.json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')
      const userId = url.searchParams.get('user_id')
      const cursor = sql.exec<{ r2_key: string }>(
        'SELECT r2_key FROM articles WHERE id = ? AND user_id = ?',
        id,
        userId,
      )
      const rows = [...cursor]
      if (rows[0]) await this.env.OFFLINE.delete(rows[0].r2_key)
      sql.exec('DELETE FROM articles WHERE id = ? AND user_id = ?', id, userId)
      return Response.json({ ok: true })
    }

    return new Response('not found', { status: 404 })
  }
}
