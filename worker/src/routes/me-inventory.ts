import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import type { AppContext } from '../types'

// /api/me/inventory — Sovereign Data Dashboard inventory feed.
//
// Returns scalar counts (and a single SUM of offline article bytes) scoped
// to the authenticated user, so the desktop dashboard can render
// "you have N bookmarks, M sites visited, P offline articles, X bytes"
// without paginating through every record. Every query is COUNT(*) /
// SUM() over an indexed user_id column — cheap on D1.
export const meInventory = new Hono<AppContext>()
meInventory.use('*', authMiddleware)

interface InventoryResponse {
  bookmarks: number
  history: number
  offline_articles: number
  offline_bytes: number
  account_created_at: number
  last_visit_at: number | null
}

meInventory.get('/', async (c) => {
  const userId = c.get('userId')!
  // Run the four counts and the two user-row lookups in parallel. We use
  // Promise.all rather than D1.batch because tuple destructuring of
  // batch()'s return is undefined-per-element under noUncheckedIndexedAccess.
  // The user row gives us account creation time; MAX(history.last_visited_at)
  // is the freshness signal.
  const [bms, hist, off, bytes, user, lastVisit] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM bookmarks WHERE user_id = ?').bind(userId).first<{ n: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM history WHERE user_id = ?').bind(userId).first<{ n: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) AS n FROM offline_articles WHERE user_id = ?').bind(userId).first<{ n: number }>(),
    c.env.DB.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS n FROM offline_articles WHERE user_id = ?').bind(userId).first<{ n: number }>(),
    c.env.DB.prepare('SELECT created_at FROM users WHERE id = ?').bind(userId).first<{ created_at: number }>(),
    c.env.DB.prepare('SELECT MAX(last_visited_at) AS t FROM history WHERE user_id = ?').bind(userId).first<{ t: number | null }>(),
  ])

  const bookmarkCount = bms?.n ?? 0
  const historyCount = hist?.n ?? 0
  const offlineCount = off?.n ?? 0
  const offlineBytes = bytes?.n ?? 0
  const createdAt = user?.created_at ?? 0
  const lastVisitAt = lastVisit?.t ?? null

  const body: InventoryResponse = {
    bookmarks: bookmarkCount,
    history: historyCount,
    offline_articles: offlineCount,
    offline_bytes: offlineBytes,
    account_created_at: createdAt,
    last_visit_at: lastVisitAt,
  }
  return c.json(body)
})
