import type { Env } from '../types'

export async function scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil(cleanupOldOfflineArticles(env))
  // Future: refresh adblock list from Ghostery TDS
}

async function cleanupOldOfflineArticles(env: Env): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
  const rows = await env.DB.prepare(
    'SELECT id, user_id, r2_key FROM offline_articles WHERE read_at IS NOT NULL AND read_at < ?'
  ).bind(cutoff).all<{ id: string; user_id: string; r2_key: string }>()
  for (const r of rows.results ?? []) {
    await env.OFFLINE.delete(r.r2_key)
    await env.DB.prepare('DELETE FROM offline_articles WHERE id = ?').bind(r.id).run()
  }
}
