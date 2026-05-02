import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types'

// Stub. Real implementation lands in Phase 8 (offline reader queue):
// per-user article download queue, R2-backed body storage, SQLite-backed
// state via this.ctx.storage.sql, retry/backoff, online-state alarms.
export class ReaderQueue extends DurableObject<Env> {
  async fetch(_req: Request): Promise<Response> {
    return new Response('reader queue not yet implemented', { status: 501 })
  }
}
