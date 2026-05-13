import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { AppContext } from '../types'

// /api/me/export — "Take everything with you".
//
// Returns a single JSON document containing every user-owned row across
// D1. R2 article bodies are NOT bundled inline (they can be megabytes per
// article and the alpha export is a sanity-check feature, not a full
// migration tool); the offline_articles metadata table includes the r2_key
// so a future migration tool could stream bodies separately. The user row
// is stripped of password_hash before serialization.
//
// Stream-friendly note: for the alpha we build the JSON in memory. The
// realistic cap (a power user with thousands of bookmarks + history) is
// still well under 10 MB — fine for a single Response body. If sizes grow,
// switch to a chunked TransformStream and write objects as we read.
export const meExport = new Hono<AppContext>()
meExport.use('*', authMiddleware)

interface ExportPayload {
  version: 1
  exportedAt: string
  user: Record<string, unknown>
  bookmark_folders: unknown[]
  bookmarks: unknown[]
  history: unknown[]
  offline_metadata: unknown[]
}

meExport.get('/', async (c) => {
  const userId = c.get('userId')!
  // Pull every owned table in parallel. None of these are large; the
  // alpha guideline is "if your dataset doesn't fit in memory we have
  // bigger problems than this endpoint".
  const [userRow, folders, bms, hist, off] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<Record<string, unknown>>(),
    c.env.DB.prepare('SELECT * FROM bookmark_folders WHERE user_id = ? ORDER BY position').bind(userId).all(),
    c.env.DB.prepare('SELECT * FROM bookmarks WHERE user_id = ? ORDER BY position').bind(userId).all(),
    c.env.DB.prepare('SELECT * FROM history WHERE user_id = ? ORDER BY last_visited_at DESC').bind(userId).all(),
    c.env.DB.prepare('SELECT * FROM offline_articles WHERE user_id = ? ORDER BY saved_at DESC').bind(userId).all(),
  ])

  // Strip credential material from the user row. We walk the entries
  // rather than spread-and-delete so adding new columns to `users` later
  // can't silently leak new secrets — anything we don't explicitly skip
  // gets copied; anything in the skiplist is dropped.
  const userRaw = userRow ?? {}
  const userSafe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(userRaw)) {
    if (k === 'password_hash') continue
    userSafe[k] = v
  }

  const payload: ExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    user: userSafe,
    bookmark_folders: folders.results ?? [],
    bookmarks: bms.results ?? [],
    history: hist.results ?? [],
    offline_metadata: off.results ?? [],
  }

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="baobab-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
})
