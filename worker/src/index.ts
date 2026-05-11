import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { AppContext } from './types'
import { requestId } from './middleware/request-id'
import { residency } from './middleware/residency'
import { auth } from './routes/auth'
import { ai } from './routes/ai'
import { proxy } from './routes/proxy'
import { history } from './routes/history'
import { bookmarks } from './routes/bookmarks'

export { ReaderQueue } from './durable-objects/reader-queue'

const app = new Hono<AppContext>()

// Order matters:
// 1. requestId — every other middleware/handler/error path needs reqId.
// 2. cors — handles OPTIONS preflight before any other work runs.
// 3. secureHeaders — applied to every response.
// 4. residency — adds X-Baobab-* observability headers.
app.use('*', requestId)
app.use('*', cors({
  origin: (origin, c) => {
    // CORS_ORIGIN is a comma-separated allowlist. Empty origin (same-origin
    // / non-browser fetch) gets passed through; cross-origin browsers are
    // matched against the list and rejected (returns null) otherwise.
    // Hono's cors() doesn't propagate AppContext typing through the callback,
    // so c.env is loosely typed here — annotate the map fn explicitly.
    if (!origin) return ''
    const corsOrigin = (c.env as { CORS_ORIGIN: string }).CORS_ORIGIN
    const allowed = corsOrigin.split(',').map((s: string) => s.trim()).filter(Boolean)
    return allowed.includes(origin) ? origin : null
  },
  credentials: true,
  allowHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposeHeaders: ['X-Request-Id', 'X-Baobab-Region', 'X-Data-Residency'],
  maxAge: 600,
}))
app.use('*', secureHeaders())
app.use('*', residency)

app.get('/', (c) => c.json({ name: c.env.APP_NAME, version: c.env.APP_VERSION }))
app.route('/api/auth', auth)
app.route('/api/ai', ai)
app.route('/api/proxy', proxy)
app.route('/api/history', history)
app.route('/api/bookmarks', bookmarks)

app.onError((err, c) => {
  const reqId = c.get('reqId')
  // Log the full error server-side (Cloudflare Logpush picks up console.* in
  // structured form); return a sanitized payload to the client with the
  // request id so support / clients can cross-reference.
  console.error(JSON.stringify({
    level: 'error',
    reqId,
    path: new URL(c.req.url).pathname,
    method: c.req.method,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  }))
  return c.json({ error: 'internal_error', requestId: reqId }, 500)
})

export default app
