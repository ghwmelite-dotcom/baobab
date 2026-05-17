# Reader Auto-Savings (Bundle B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing Reader Mode into an auto-data-savings layer: on slow connections, a 3-second countdown intercepts heavy navigations before the tab webview loads them; cleaned page renders in a new `reader.html` Vite entry; savings feed Bundle A's `data.store` gauge.

**Architecture:** TS-only navigation intercept at `Omnibar.tsx` + `TabStrip.tsx` (in-page link clicks deferred to v1.x). New `reader.html` is a sibling Vite entry to `picker.html` / `search.html`. Worker `/api/proxy/fetch` becomes public; surfaces `bytes_saved` (domain-tier multiplier) and `bytes_saved_adblock`. `tab.url` of the form `…/reader.html?url=…` is the via-Reader signal — derived, not stored on the Tab type.

**Tech Stack:** React 18 + Zustand (chrome + reader-app), Vite multi-page (`rollupOptions.input`), Tauri IPC (`__TAURI_INTERNALS__.invoke`), DOMPurify (sanitization), Hono + Workers AI (worker), Vitest (TS), Cargo (Rust — no v1 touches).

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-16-reader-auto-savings-design.md` (commit `52db1fa`)
- Bundle A spec: `docs/superpowers/specs/2026-05-16-data-savings-suite-design.md`
- Search portal pattern (template for reader.html): `docs/superpowers/specs/2026-05-16-search-portal-design.md` and `apps/desktop/search.html` / `apps/desktop/src/search-app/`
- Existing Reader (manual mode being evolved): `apps/desktop/src/reader/` + `worker/src/routes/proxy.ts`

**Working directory for desktop tasks:** `apps/desktop/` (paths below are relative to it unless prefixed `worker/` or `docs/`).

---

## Task 1: Worker — `factorFor()` domain-tier multiplier

**Files:**
- Modify: `worker/src/services/reader.ts`
- Create: `worker/test/reader.factor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `worker/test/reader.factor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { factorFor } from '../src/services/reader'

describe('factorFor', () => {
  it('returns 8 for news domains', () => {
    expect(factorFor('www.nytimes.com')).toBe(8)
    expect(factorFor('bbc.co.uk')).toBe(8)
    expect(factorFor('edition.cnn.com')).toBe(8)
    expect(factorFor('www.guardian.co.uk')).toBe(8)
    expect(factorFor('www.washingtonpost.com')).toBe(8)
    expect(factorFor('www.reuters.com')).toBe(8)
  })

  it('returns 5 for blog platforms', () => {
    expect(factorFor('medium.com')).toBe(5)
    expect(factorFor('someone.substack.com')).toBe(5)
    expect(factorFor('blog.wordpress.com')).toBe(5)
    expect(factorFor('me.blogspot.com')).toBe(5)
  })

  it('returns 2 for app-like domains', () => {
    expect(factorFor('app.slack.com')).toBe(2)
    expect(factorFor('github.com')).toBe(2)
    expect(factorFor('some.app')).toBe(2)
  })

  it('returns 4 for everything else', () => {
    expect(factorFor('example.com')).toBe(4)
    expect(factorFor('random.io')).toBe(4)
    expect(factorFor('news.unknown.ng')).toBe(4)
  })

  it('is case-insensitive on hostname', () => {
    expect(factorFor('NYTIMES.com')).toBe(8)
    expect(factorFor('Medium.com')).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd worker && npx vitest run test/reader.factor.test.ts
```
Expected: FAIL — `factorFor` is not exported from `../src/services/reader`.

- [ ] **Step 3: Add `factorFor` to `worker/src/services/reader.ts`**

Append to the bottom of `worker/src/services/reader.ts`:

```ts
// ── bytes-saved multiplier ──────────────────────────────────────────────
// Estimate of total page weight (HTML + images + JS + CSS) relative to
// the HTML doc alone. Multiplier × raw.length approximates what the user
// would have downloaded without Reader. Conservative-by-default.

const FACTOR_TABLE: readonly [RegExp, number][] = [
  // News
  [/(?:^|\.)nytimes\.com$/, 8],
  [/(?:^|\.)bbc\.(?:co\.uk|com)$/, 8],
  [/(?:^|\.)cnn\.com$/, 8],
  [/(?:^|\.)guardian\.co\.uk$/, 8],
  [/(?:^|\.)washingtonpost\.com$/, 8],
  [/(?:^|\.)reuters\.com$/, 8],
  // Blog platforms
  [/(?:^|\.)medium\.com$/, 5],
  [/(?:^|\.)substack\.com$/, 5],
  [/(?:^|\.)wordpress\.com$/, 5],
  [/\.blogspot\./, 5],
  // App-like
  [/(?:^|\.)slack\.com$/, 2],
  [/(?:^|\.)github\.com$/, 2],
  [/\.app$/, 2],
]
const DEFAULT_FACTOR = 4

export function factorFor(hostname: string): number {
  const h = hostname.toLowerCase()
  for (const [re, f] of FACTOR_TABLE) {
    if (re.test(h)) return f
  }
  return DEFAULT_FACTOR
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd worker && npx vitest run test/reader.factor.test.ts
```
Expected: PASS — 5 tests, all green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/services/reader.ts worker/test/reader.factor.test.ts
git commit -m "feat(reader): factorFor() domain-tier multiplier for bytes-saved estimate

Returns 8 (news), 5 (blog platforms), 2 (app-like), 4 (default) per the
Bundle B spec. Used by /api/proxy/fetch to estimate bytes_saved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Worker — make `/api/proxy/fetch` public

**Files:**
- Modify: `worker/src/routes/proxy.ts`
- Modify: `worker/test/proxy.test.ts` (or create if missing)

- [ ] **Step 1: Check whether `worker/test/proxy.test.ts` exists**

```bash
ls worker/test/proxy.test.ts 2>/dev/null && echo "exists" || echo "missing"
```

If missing, create it with the basic shape (see Step 2). If it exists, append the new tests at the end.

- [ ] **Step 2: Write the failing test**

Add to `worker/test/proxy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'   // root Hono app

describe('/api/proxy/fetch public route', () => {
  it('returns 200 without an Authorization header (was 401 pre-Bundle-B)', async () => {
    const res = await app.fetch(
      new Request('https://example.workers.dev/api/proxy/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/article',
          html_content: '<html><body><article><h1>Hi</h1><p>Body</p></article></body></html>',
          skip_ai: true,
        }),
      }),
      // Test env stub — see existing tests in this file for shape; the env should
      // include DB (D1 stub), PAGE_CACHE (KV stub), RATE_LIMITS (KV stub), and any
      // AI binding the route reads but won't invoke when skip_ai is true.
      makeTestEnv(),
    )
    expect(res.status).toBe(200)
  })

  it('still rate-limits anonymous requests by IP (429 after 30 in a window)', async () => {
    const env = makeTestEnv()
    const headers = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.5' }
    const body = JSON.stringify({
      url: 'https://example.com/x',
      html_content: '<html><body><article>x</article></body></html>',
      skip_ai: true,
    })
    // Hit limit + 1
    for (let i = 0; i < 30; i++) {
      const ok = await app.fetch(new Request('https://example.workers.dev/api/proxy/fetch', { method: 'POST', headers, body }), env)
      expect(ok.status).toBe(200)
    }
    const limited = await app.fetch(new Request('https://example.workers.dev/api/proxy/fetch', { method: 'POST', headers, body }), env)
    expect(limited.status).toBe(429)
  })
})
```

If `makeTestEnv()` doesn't already exist in the test file, copy the existing pattern from other `worker/test/*.test.ts` files for KV/D1 stub construction. The point of this task is the route's auth surface, not env mocking — reuse what's there.

- [ ] **Step 3: Run test to verify it fails**

```bash
cd worker && npx vitest run test/proxy.test.ts
```
Expected: FAIL — first test gets 401 because authMiddleware is still gating the route.

- [ ] **Step 4: Drop authMiddleware on `/fetch`**

Edit `worker/src/routes/proxy.ts`. Remove the route-level `proxy.use('*', authMiddleware)` line so only `rateLimit` remains. The route handler stays; just stop forcing auth:

Find:
```ts
proxy.use('*', authMiddleware)
proxy.use('*', rateLimit({ requests: 30, windowSec: 60, keyPrefix: 'proxy' }))
```

Replace with:
```ts
// /api/proxy/fetch is intentionally public for Bundle B. reader.html runs in a
// fresh JS context that doesn't carry the parent profile's auth.store; gating
// it on auth would defeat the bundle thesis. Mirrors /api/ai/search.
// rate-limit middleware naturally keys on CF-Connecting-IP when userId is null
// (see middleware/rate-limit.ts:24–26).
proxy.use('*', rateLimit({ requests: 30, windowSec: 60, keyPrefix: 'proxy' }))
```

- [ ] **Step 5: Make the D1 `adblock_stats` write conditional on `userId`**

In the same file, find the `INSERT INTO adblock_stats` block:

```ts
await c.env.DB.prepare(
  'INSERT INTO adblock_stats (id, user_id, url, ads_blocked, trackers_blocked, bytes_saved) VALUES (?, ?, ?, ?, ?, ?)'
).bind(newId(), c.get('userId'), body.url, ads_blocked, trackers_blocked, raw.length - html.length).run()
```

Wrap in a userId guard:

```ts
const uid = c.get('userId')
if (uid) {
  await c.env.DB.prepare(
    'INSERT INTO adblock_stats (id, user_id, url, ads_blocked, trackers_blocked, bytes_saved) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(newId(), uid, body.url, ads_blocked, trackers_blocked, raw.length - html.length).run()
}
```

Also remove the `getUserById` call for `lowBw` (we no longer have a userId for anonymous calls). The AI summary code path needs adjustment — change:

```ts
if (!body.skip_ai && page.word_count > 50) {
  const user = await getUserById(c.env.DB, c.get('userId')!)
  const model = pickModel(c.env, { lowBw: !!user?.low_bandwidth_mode, model: c.env.SUMMARIZE_MODEL })
  ...
}
```

To:

```ts
if (!body.skip_ai && page.word_count > 50) {
  const user = uid ? await getUserById(c.env.DB, uid) : null
  const model = pickModel(c.env, { lowBw: !!user?.low_bandwidth_mode, model: c.env.SUMMARIZE_MODEL })
  ...
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd worker && npx vitest run test/proxy.test.ts
```
Expected: PASS — both new tests + any existing.

- [ ] **Step 7: Commit**

```bash
git add worker/src/routes/proxy.ts worker/test/proxy.test.ts
git commit -m "feat(reader): make /api/proxy/fetch public for Bundle B

reader.html runs in a fresh JS context that can't carry the parent profile's
auth.store, so the existing authMiddleware would block every Reader fetch.
Mirrors the /api/ai/search public route shipped for the search portal v1.
rate-limit middleware naturally falls back to per-IP keying when userId is
null; D1 adblock_stats write becomes conditional on auth presence.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Worker — surface `bytes_saved` + `bytes_saved_adblock` in response

**Files:**
- Modify: `worker/src/routes/proxy.ts`
- Modify: `worker/test/proxy.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `worker/test/proxy.test.ts`:

```ts
describe('/api/proxy/fetch bytes-saved surfacing', () => {
  it('returns bytes_saved using the domain-tier multiplier', async () => {
    // Fixture: 1000-byte raw HTML for an nytimes URL → factor 8
    const html = '<html><body>' + 'x'.repeat(900) + '<article>title</article></body></html>'
    const res = await app.fetch(
      new Request('https://example.workers.dev/api/proxy/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.nytimes.com/article/abc',
          html_content: html,
          skip_ai: true,
        }),
      }),
      makeTestEnv(),
    )
    expect(res.status).toBe(200)
    const json = await res.json() as {
      bytes_saved: number
      bytes_saved_adblock: number
      cleaned_html: string
    }
    // factor=8, raw.length ≈ html.length. Response includes cleaned_html so it's
    // smaller than (raw × 8). Sanity check: bytes_saved is positive and far
    // larger than just the html.length - cleaned_html.length diff.
    expect(json.bytes_saved).toBeGreaterThan(html.length * 6)
    expect(json.bytes_saved_adblock).toBeGreaterThanOrEqual(0)
  })

  it('returns bytes_saved >= 0 for default-factor domains', async () => {
    const html = '<html><body><article>' + 'y'.repeat(500) + '</article></body></html>'
    const res = await app.fetch(
      new Request('https://example.workers.dev/api/proxy/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/page', html_content: html, skip_ai: true }),
      }),
      makeTestEnv(),
    )
    const json = await res.json() as { bytes_saved: number }
    // factor=4, raw=~530 bytes → ~2120 estimate. Response is ~600 bytes. saved ≈ 1500.
    expect(json.bytes_saved).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd worker && npx vitest run test/proxy.test.ts
```
Expected: FAIL — response shape doesn't include `bytes_saved` / `bytes_saved_adblock`.

- [ ] **Step 3: Compute and return both fields**

In `worker/src/routes/proxy.ts`, at the top of the file add the import:

```ts
import { extractReadable, factorFor, summarizeAndExtract } from '../services/reader'
```

Find the existing return block:

```ts
const result = {
  title: page.title,
  cleaned_html: page.cleaned_html,
  text: page.text,
  word_count: page.word_count,
  est_read_minutes: page.est_read_minutes,
  ads_blocked,
  trackers_blocked,
  ai_summary,
  key_points,
  cached: false,
}

await c.env.PAGE_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 1800 })
return c.json(result)
```

Replace with:

```ts
const responseBody = {
  title: page.title,
  cleaned_html: page.cleaned_html,
  text: page.text,
  word_count: page.word_count,
  est_read_minutes: page.est_read_minutes,
  ads_blocked,
  trackers_blocked,
  ai_summary,
  key_points,
  cached: false,
}

// Bytes-saved estimate. raw is the origin's HTML doc; the user, without
// Reader, would have fetched it plus typical sub-resources (images, JS,
// CSS). factorFor() scales raw by hostname tier. Conservative: clamp to >= 0.
const responseSize = JSON.stringify(responseBody).length
const fullPageEstimate = factorFor(parsed.hostname) * raw.length
const bytes_saved = Math.max(0, fullPageEstimate - responseSize)
const bytes_saved_adblock = Math.max(0, raw.length - html.length)

const result = { ...responseBody, bytes_saved, bytes_saved_adblock }
await c.env.PAGE_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 1800 })
return c.json(result)
```

The `parsed` URL was constructed earlier in the route. Verify it's still in scope; if not, hoist the `new URL(body.url)` parse above the response composition.

Also make sure the cached `cached: true` branch returns the same shape — `JSON.parse(cached)` should already carry the fields because we put the full result. No change needed there.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd worker && npx vitest run test/proxy.test.ts
```
Expected: PASS — bytes-saved tests green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/proxy.ts worker/test/proxy.test.ts
git commit -m "feat(reader): surface bytes_saved + bytes_saved_adblock in proxy/fetch response

Worker computes bytes_saved = factorFor(host) × raw.length − response.length
(clamped to >= 0) and surfaces the existing ad-strip savings as
bytes_saved_adblock. reader.html will relay both into Bundle A's data.store
via record_tab_usage so the gauge reflects Reader savings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Intercept policy module — `src/reader/intercept.ts`

**Files:**
- Create: `apps/desktop/src/reader/intercept.ts`
- Create: `apps/desktop/tests/reader.intercept.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/reader.intercept.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from '~/state/connection.store'
import {
  shouldInterceptNavigation,
  markUserOverride,
  __resetInterceptOverridesForTest,
} from '~/reader/intercept'

beforeEach(() => {
  // Slow-mode baseline so intercept fires by default
  useConnectionStore.setState({
    effectiveType: '2g',
    type: 'cellular',
    isOffline: false,
    isSlow: true,
    slowModeForced: false,
    downlinkMbps: 0,
    saveData: false,
  })
  __resetInterceptOverridesForTest()
})

describe('shouldInterceptNavigation', () => {
  it('intercepts a normal URL when slow', () => {
    expect(shouldInterceptNavigation('https://example.com/article')).toBe(true)
  })

  it('does NOT intercept when not slow-effective', () => {
    useConnectionStore.setState({ effectiveType: '4g', type: 'wifi', isSlow: false })
    expect(shouldInterceptNavigation('https://example.com/article')).toBe(false)
  })

  it('does NOT intercept skip-list hosts', () => {
    expect(shouldInterceptNavigation('https://google.com/search?q=x')).toBe(false)
    expect(shouldInterceptNavigation('https://mail.google.com/inbox')).toBe(false)
    expect(shouldInterceptNavigation('https://github.com/owner/repo')).toBe(false)
    expect(shouldInterceptNavigation('https://web.whatsapp.com/')).toBe(false)
  })

  it('does NOT intercept skip-list host suffixes', () => {
    expect(shouldInterceptNavigation('https://team.slack.com/messages')).toBe(false)
    expect(shouldInterceptNavigation('https://something.app/')).toBe(false)
  })

  it('does NOT intercept login/signin/auth paths', () => {
    expect(shouldInterceptNavigation('https://example.com/login')).toBe(false)
    expect(shouldInterceptNavigation('https://example.com/signin')).toBe(false)
    expect(shouldInterceptNavigation('https://example.com/auth/callback')).toBe(false)
  })

  it('does NOT intercept non-http(s) schemes', () => {
    expect(shouldInterceptNavigation('about:blank')).toBe(false)
    expect(shouldInterceptNavigation('tauri://localhost/picker.html')).toBe(false)
    expect(shouldInterceptNavigation('file:///c/x')).toBe(false)
  })

  it('does NOT intercept malformed URLs', () => {
    expect(shouldInterceptNavigation('not a url')).toBe(false)
    expect(shouldInterceptNavigation('')).toBe(false)
  })

  it('does NOT intercept within the 5-min user-override window', () => {
    markUserOverride('https://example.com/anything')
    expect(shouldInterceptNavigation('https://example.com/other')).toBe(false)
    // Different host still intercepts
    expect(shouldInterceptNavigation('https://other.com/x')).toBe(true)
  })

  it('intercept resumes after the override window elapses', () => {
    vi.useFakeTimers()
    markUserOverride('https://example.com/page')
    expect(shouldInterceptNavigation('https://example.com/page2')).toBe(false)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(shouldInterceptNavigation('https://example.com/page3')).toBe(true)
    vi.useRealTimers()
  })
})
```

Add `import { vi } from 'vitest'` to the top imports.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/reader.intercept.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `intercept.ts`**

Create `apps/desktop/src/reader/intercept.ts`:

```ts
import { useConnectionStore } from '~/state/connection.store'

/**
 * In-process per-window memory of "user cancelled the countdown for this host" —
 * used to suppress repeat prompts for 5 minutes. Per-window: profile-switching
 * naturally resets it (no persistence needed).
 */
const overrideUntil = new Map<string, number>()
const OVERRIDE_TTL_MS = 5 * 60 * 1000

/** Hosts that should NEVER trigger the countdown, regardless of connection. */
const SKIP_HOSTS = new Set<string>([
  // search engines
  'google.com', 'www.google.com', 'bing.com', 'www.bing.com', 'duckduckgo.com',
  // login flows
  'accounts.google.com', 'login.microsoftonline.com',
  // app-like
  'gmail.com', 'mail.google.com', 'github.com', 'web.whatsapp.com',
])
const SKIP_HOST_SUFFIXES: readonly string[] = ['.slack.com', '.app']
const SKIP_PATH_PATTERNS: readonly RegExp[] = [
  /^\/(?:login|signin|sign-in|auth)(?:\/|$)/i,
]

export function shouldInterceptNavigation(url: string): boolean {
  let parsed: URL
  try { parsed = new URL(url) } catch { return false }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false

  const s = useConnectionStore.getState()
  if (s.isOffline) return false
  // isSlowEffective derives from isSlow OR slowModeForced
  if (!s.isSlow && !s.slowModeForced) return false

  const host = parsed.hostname.toLowerCase()
  if (SKIP_HOSTS.has(host)) return false
  if (SKIP_HOST_SUFFIXES.some((suf) => host.endsWith(suf))) return false
  if (SKIP_PATH_PATTERNS.some((re) => re.test(parsed.pathname))) return false

  const until = overrideUntil.get(host)
  if (until && Date.now() < until) return false

  return true
}

export function markUserOverride(url: string): void {
  try {
    const host = new URL(url).hostname.toLowerCase()
    overrideUntil.set(host, Date.now() + OVERRIDE_TTL_MS)
  } catch {
    // ignore malformed urls
  }
}

/** @internal Test-only hatch — clears the in-process override map. */
export function __resetInterceptOverridesForTest(): void {
  overrideUntil.clear()
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/reader.intercept.test.ts
```
Expected: PASS — 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/reader/intercept.ts apps/desktop/tests/reader.intercept.test.ts
git commit -m "feat(reader): shouldInterceptNavigation policy + 5-min user-override window

Bundle B's heavy-page detection: every slow-mode navigation prompts unless
the URL matches the skip-list (search engines, login flows, app-like
domains) or the user cancelled the countdown for this host within the
last 5 minutes. Zero network cost — the countdown itself is the heuristic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: CountdownModal component — `src/reader/CountdownModal.tsx`

**Files:**
- Create: `apps/desktop/src/reader/CountdownModal.tsx`
- Create: `apps/desktop/tests/reader.countdown.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/reader.countdown.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { CountdownModal } from '~/reader/CountdownModal'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('<CountdownModal>', () => {
  it('renders the URL and a countdown', () => {
    render(<CountdownModal url="https://example.com/x" onAccept={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/example\.com\/x/)).toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('counts down 3 → 2 → 1 → fires onAccept', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText(/2/)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText(/1/)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onAccept).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel on Escape', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('fires onAccept on Enter (skip wait)', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it('"Open now" button fires onAccept immediately', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /open now/i }))
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it('"Cancel" button fires onCancel', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('respects a custom seconds prop', () => {
    const onAccept = vi.fn()
    render(<CountdownModal url="https://example.com/x" seconds={1} onAccept={onAccept} onCancel={() => {}} />)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onAccept).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/reader.countdown.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `CountdownModal.tsx`**

Create `apps/desktop/src/reader/CountdownModal.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

export interface CountdownModalProps {
  url: string
  seconds?: number
  onAccept: () => void
  onCancel: () => void
}

export function CountdownModal({ url, seconds = 3, onAccept, onCancel }: CountdownModalProps) {
  const [remaining, setRemaining] = useState(seconds)
  const acceptedRef = useRef(false)
  const cancelledRef = useRef(false)

  // We latch the first decision so a click on Cancel doesn't get overruled
  // by a countdown-tick that lands in the same React commit.
  const fireAccept = () => {
    if (acceptedRef.current || cancelledRef.current) return
    acceptedRef.current = true
    onAccept()
  }
  const fireCancel = () => {
    if (acceptedRef.current || cancelledRef.current) return
    cancelledRef.current = true
    onCancel()
  }

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id)
          // Defer to avoid setState-during-render
          queueMicrotask(fireAccept)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); fireCancel() }
      else if (e.key === 'Enter') { e.preventDefault(); fireAccept() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Heavy page on slow mode"
      onClick={(e) => { if (e.target === e.currentTarget) fireCancel() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9100,
      }}
    >
      <div
        style={{
          minWidth: 320, maxWidth: 440,
          background: 'var(--surface-1)', color: 'var(--text-primary)',
          border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)',
          borderRadius: 10, padding: '18px 20px',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.55)',
          fontFamily: 'var(--font-default)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Heavy page on slow mode</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, wordBreak: 'break-all' }}>{url}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Opening in Reader in {remaining}…
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={fireCancel}
            style={ghostBtn}
          >Cancel</button>
          <button
            type="button"
            onClick={fireAccept}
            style={accentBtn}
            autoFocus
          >Open now</button>
        </div>
      </div>
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '6px 14px', fontSize: 12.5, cursor: 'pointer',
}
const accentBtn: React.CSSProperties = {
  background: 'var(--accent)', color: 'var(--text-on-accent)',
  border: 'none', borderRadius: 8,
  padding: '6px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/reader.countdown.test.tsx
```
Expected: PASS — 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/reader/CountdownModal.tsx apps/desktop/tests/reader.countdown.test.tsx
git commit -m "feat(reader): CountdownModal — 3-sec warn-then-open dialog

3-second countdown (Esc/click-outside cancel · Enter/Open-now accept) for
Bundle B's heavy-page intercept. Latches first decision so a click on
Cancel can't be overruled by a tick landing in the same commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: ReaderPill component — `src/reader/ReaderPill.tsx`

**Files:**
- Create: `apps/desktop/src/reader/ReaderPill.tsx`
- Create: `apps/desktop/tests/reader.pill.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/reader.pill.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { ReaderPill } from '~/reader/ReaderPill'

describe('<ReaderPill>', () => {
  it('renders the "📖 Reader" label', () => {
    render(<ReaderPill onLoadFullPage={() => {}} />)
    expect(screen.getByRole('button', { name: /reader/i })).toBeInTheDocument()
  })

  it('fires onLoadFullPage when clicked', () => {
    const onLoadFullPage = vi.fn()
    render(<ReaderPill onLoadFullPage={onLoadFullPage} />)
    fireEvent.click(screen.getByRole('button', { name: /reader/i }))
    expect(onLoadFullPage).toHaveBeenCalledOnce()
  })

  it('shows a tooltip', () => {
    render(<ReaderPill onLoadFullPage={() => {}} />)
    expect(screen.getByRole('button', { name: /reader/i })).toHaveAttribute('title')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/reader.pill.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `ReaderPill.tsx`**

Create `apps/desktop/src/reader/ReaderPill.tsx`:

```tsx
export interface ReaderPillProps {
  onLoadFullPage: () => void
}

export function ReaderPill({ onLoadFullPage }: ReaderPillProps) {
  return (
    <button
      type="button"
      onClick={onLoadFullPage}
      title="Reader mode — click to load the full page"
      aria-label="Reader mode — click to load the full page"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 20,
        paddingInline: 8,
        marginRight: 6,
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'rgba(217, 164, 90, 0.18)',
        color: 'var(--accent)',
        fontSize: 10.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden>📖</span>
      <span>Reader</span>
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/reader.pill.test.tsx
```
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/reader/ReaderPill.tsx apps/desktop/tests/reader.pill.test.tsx
git commit -m "feat(reader): ReaderPill — omnibar indicator + load-full-page button

Renders next to the URL when the active tab is via-Reader. Click loads
the original URL (caller is responsible for navigating + marking the
5-min skip-list override).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Reader-URL derivation helpers — extend `src/reader/intercept.ts`

**Files:**
- Modify: `apps/desktop/src/reader/intercept.ts`
- Create: `apps/desktop/tests/reader.url.test.ts`

**Why here:** Both Omnibar and ReaderApp need to round-trip `reader.html?url=…`. Extract the construction + parsing into one place so the dev/prod base-URL switch isn't duplicated.

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/reader.url.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { READER_BASE_URL, READER_URL_RE, buildReaderUrl, parseReaderUrl } from '~/reader/intercept'

describe('reader URL helpers', () => {
  it('READER_BASE_URL ends with /reader.html', () => {
    expect(READER_BASE_URL.endsWith('/reader.html')).toBe(true)
  })

  it('buildReaderUrl encodes the original URL into the query string', () => {
    const u = buildReaderUrl('https://example.com/article?a=1&b=2')
    expect(u).toContain('reader.html?url=')
    expect(u).toContain(encodeURIComponent('https://example.com/article?a=1&b=2'))
  })

  it('parseReaderUrl returns the original URL', () => {
    const orig = 'https://example.com/article?a=1&b=2'
    const r = parseReaderUrl(buildReaderUrl(orig))
    expect(r).toBe(orig)
  })

  it('parseReaderUrl returns null for non-reader URLs', () => {
    expect(parseReaderUrl('https://example.com/article')).toBe(null)
    expect(parseReaderUrl('about:blank')).toBe(null)
    expect(parseReaderUrl('tauri://localhost/picker.html')).toBe(null)
  })

  it('READER_URL_RE matches both dev and prod', () => {
    expect('http://localhost:1420/reader.html?url=foo').toMatch(READER_URL_RE)
    expect('tauri://localhost/reader.html?url=foo').toMatch(READER_URL_RE)
    expect('https://example.com/reader.html').not.toMatch(READER_URL_RE)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/reader.url.test.ts
```
Expected: FAIL — exports don't exist.

- [ ] **Step 3: Add the URL helpers**

Append to `apps/desktop/src/reader/intercept.ts`:

```ts
// ── Reader-URL plumbing ─────────────────────────────────────────────────
// We point the tab webview at our internal `reader.html` Vite entry instead
// of the heavy origin. Tauri parses absolute URLs only, so dev hits
// http://localhost:1420 and prod hits tauri://localhost. Mirrors the same
// dev/prod switch the search portal uses for search.html.

export const READER_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:1420/reader.html'
  : 'tauri://localhost/reader.html'

export const READER_URL_RE =
  /^(?:tauri:\/\/localhost|https?:\/\/localhost(?::\d+)?)\/reader\.html\?url=(.*)$/

export function buildReaderUrl(originalUrl: string): string {
  return `${READER_BASE_URL}?url=${encodeURIComponent(originalUrl)}`
}

export function parseReaderUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(READER_URL_RE)
  if (!m || !m[1]) return null
  try { return decodeURIComponent(m[1]) } catch { return null }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/reader.url.test.ts
```
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/reader/intercept.ts apps/desktop/tests/reader.url.test.ts
git commit -m "feat(reader): buildReaderUrl / parseReaderUrl + dev-vs-prod base switch

Centralises the reader.html absolute URL construction so Omnibar (build)
and tab-state derivation (parse) don't duplicate the dev-vs-prod regex.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `reader.html` Vite entry + skeleton React tree

**Files:**
- Create: `apps/desktop/reader.html`
- Create: `apps/desktop/src/reader-app/main.tsx`
- Create: `apps/desktop/src/reader-app/ReaderApp.tsx`
- Modify: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/tests/reader.app.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/reader.app.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReaderApp } from '~/reader-app/ReaderApp'

// jsdom needs URLSearchParams; it has it. We control location.search via the
// global URL.
function setUrl(search: string): void {
  const u = new URL('http://localhost:1420/reader.html')
  u.search = search
  // jsdom respects history.replaceState for location.search
  window.history.replaceState({}, '', u.toString())
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('<ReaderApp>', () => {
  it('renders an error pane when ?url= is missing', () => {
    setUrl('')
    render(<ReaderApp />)
    expect(screen.getByText(/no url provided/i)).toBeInTheDocument()
  })

  it('POSTs to /api/proxy/fetch with the decoded url + skip_ai', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        title: 'T', cleaned_html: '<p>Body</p>', text: 'Body', word_count: 1,
        est_read_minutes: 1, ads_blocked: 0, trackers_blocked: 0,
        ai_summary: '', key_points: [], cached: false,
        bytes_saved: 12345, bytes_saved_adblock: 678,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ReaderApp />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const call = fetchMock.mock.calls[0]
    const req = call[0] as Request
    expect(req.url).toContain('/api/proxy/fetch')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.url).toBe('https://example.com/article')
    expect(typeof body.skip_ai).toBe('boolean')
    await waitFor(() => expect(screen.getByText('Body')).toBeInTheDocument())
  })

  it('shows the saving header after a successful fetch', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        title: 'T', cleaned_html: '<p>x</p>', text: 'x', word_count: 1,
        est_read_minutes: 1, ads_blocked: 0, trackers_blocked: 0,
        ai_summary: '', key_points: [], cached: false,
        bytes_saved: 1_500_000, bytes_saved_adblock: 100_000,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ReaderApp />)
    await waitFor(() => expect(screen.getByText(/saved ≈/i)).toBeInTheDocument())
    expect(screen.getByText(/1\.5 MB/)).toBeInTheDocument()
  })

  it('renders an error pane on fetch 5xx with a Load full page button', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 502 })))
    render(<ReaderApp />)
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /load full page/i })).toHaveAttribute('href', 'https://example.com/article')
  })

  it('reports bytes_saved via __TAURI_INTERNALS__.invoke', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    const invoke = vi.fn(async () => undefined)
    // @ts-expect-error injecting global for test
    window.__TAURI_INTERNALS__ = { invoke }
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        title: 'T', cleaned_html: '<p>x</p>', text: 'x', word_count: 1,
        est_read_minutes: 1, ads_blocked: 0, trackers_blocked: 0,
        ai_summary: '', key_points: [], cached: false,
        bytes_saved: 1000, bytes_saved_adblock: 200,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    render(<ReaderApp />)
    await waitFor(() => expect(invoke).toHaveBeenCalled())
    const call = invoke.mock.calls[0]
    expect(call[0]).toBe('record_tab_usage')
    expect(call[1]).toEqual({ bytesUsed: 0, bytesSaved: 1200 })
    // @ts-expect-error cleanup
    delete window.__TAURI_INTERNALS__
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/reader.app.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Create `apps/desktop/reader.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reader · Baobab</title>
    <link rel="stylesheet" href="/src/styles/globals.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/reader-app/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `apps/desktop/src/reader-app/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ReaderApp } from './ReaderApp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReaderApp />
  </React.StrictMode>,
)
```

- [ ] **Step 5: Create `apps/desktop/src/reader-app/ReaderApp.tsx`**

```tsx
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? 'https://baobab-api.ohcsghana-main.workers.dev'

interface ReaderResponse {
  title: string
  cleaned_html: string
  text: string
  word_count: number
  est_read_minutes: number
  ads_blocked: number
  trackers_blocked: number
  ai_summary: string
  key_points: string[]
  cached: boolean
  bytes_saved: number
  bytes_saved_adblock: number
}

function detectSkipAi(): boolean {
  // reader.html doesn't share connection.store with the chrome. Read
  // navigator.connection directly. Mirror connection.store.compute logic.
  const c = (navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; saveData?: boolean }
  }).connection
  const eff = c?.effectiveType ?? 'unknown'
  const dl = typeof c?.downlink === 'number' ? c.downlink : 0
  const saveData = c?.saveData === true
  return eff === 'slow-2g' || eff === '2g' || (dl > 0 && dl < 1.5) || saveData
}

function formatMb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function reportSavings(saved: number): void {
  // bytes_used is 0 here because engine.js's fetch hook (Bundle A) already
  // counted the /api/proxy/fetch response's Content-Length on the way in.
  const inv = (window as Window & { __TAURI_INTERNALS__?: { invoke: (n: string, p: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
  if (!inv?.invoke) return
  inv.invoke('record_tab_usage', { bytesUsed: 0, bytesSaved: saved }).catch(() => {})
}

export function ReaderApp() {
  const urlParam = new URLSearchParams(location.search).get('url')
  const [data, setData] = useState<ReaderResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!!urlParam)

  useEffect(() => {
    if (!urlParam) return
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/proxy/fetch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlParam, skip_ai: detectSkipAi() }),
        })
        if (!res.ok) throw new Error(`${res.status}`)
        const json = (await res.json()) as ReaderResponse
        if (!alive) return
        if (!json.cleaned_html || json.word_count < 20) {
          setError('extraction-failed')
        } else {
          setData(json)
          reportSavings(json.bytes_saved + json.bytes_saved_adblock)
        }
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'fetch-failed')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [urlParam])

  if (!urlParam) {
    return <ErrorPane title="No URL provided" originalUrl={null} />
  }
  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-muted)', fontFamily: 'var(--font-default)' }}>Reading carefully…</div>
  }
  if (error || !data) {
    return <ErrorPane title="Couldn't load this page in Reader." originalUrl={urlParam} detail={error ?? undefined} />
  }
  return (
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '24px 32px', fontFamily: 'var(--font-default)' }}>
      <header style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>📖 saved ≈ {formatMb(data.bytes_saved + data.bytes_saved_adblock)} · {data.est_read_minutes} min read · {data.ads_blocked} ads blocked</span>
        <a href={urlParam} style={{ color: 'var(--accent)', textDecoration: 'none' }}>Load full page</a>
      </header>
      <h1 style={{ fontSize: 28, lineHeight: 1.25, color: 'var(--text-primary)' }}>{data.title}</h1>
      <div
        style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text-primary)' }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.cleaned_html, { USE_PROFILES: { html: true } }) }}
      />
    </article>
  )
}

function ErrorPane({ title, originalUrl, detail }: { title: string; originalUrl: string | null; detail?: string }) {
  return (
    <div style={{ maxWidth: 480, margin: '120px auto', padding: 24, fontFamily: 'var(--font-default)' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h1>
      {detail && import.meta.env.DEV && (
        <pre style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{detail}</pre>
      )}
      {originalUrl && (
        <a href={originalUrl} style={{ color: 'var(--accent)' }}>Load full page</a>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Add `reader` to `vite.config.ts` rollupOptions.input**

Edit `apps/desktop/vite.config.ts`. Find:

```ts
input: {
  main: path.resolve(__dirname, 'index.html'),
  picker: path.resolve(__dirname, 'picker.html'),
  search: path.resolve(__dirname, 'search.html'),
},
```

Replace with:

```ts
input: {
  main: path.resolve(__dirname, 'index.html'),
  picker: path.resolve(__dirname, 'picker.html'),
  search: path.resolve(__dirname, 'search.html'),
  reader: path.resolve(__dirname, 'reader.html'),
},
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npx vitest run tests/reader.app.test.tsx
```
Expected: PASS — 5 tests green.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/reader.html apps/desktop/src/reader-app/ apps/desktop/vite.config.ts apps/desktop/tests/reader.app.test.tsx
git commit -m "feat(reader): reader.html Vite entry + ReaderApp skeleton

New sibling to picker.html/search.html. ReaderApp fetches via
/api/proxy/fetch with skip_ai derived from navigator.connection,
DOMPurify-sanitizes cleaned_html, reports bytes_saved + bytes_saved_adblock
to Bundle A's data.store via record_tab_usage. Error pane includes a
'Load full page' escape hatch on every failure path.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: SummarizePill — opt-in AI summary on reader.html

**Files:**
- Create: `apps/desktop/src/reader-app/SummarizePill.tsx`
- Modify: `apps/desktop/src/reader-app/ReaderApp.tsx`
- Create: `apps/desktop/tests/reader.summarize.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/reader.summarize.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { SummarizePill } from '~/reader-app/SummarizePill'

describe('<SummarizePill>', () => {
  it('renders the "+ Summarize" button', () => {
    render(<SummarizePill text="Body text" onSummary={() => {}} />)
    expect(screen.getByRole('button', { name: /summarize/i })).toBeInTheDocument()
  })

  it('fires onSummary with the AI response on click', async () => {
    const onSummary = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ summary: '3-sentence summary.' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })))
    render(<SummarizePill text="Body text" onSummary={onSummary} />)
    fireEvent.click(screen.getByRole('button', { name: /summarize/i }))
    await waitFor(() => expect(onSummary).toHaveBeenCalledWith('3-sentence summary.'))
  })

  it('shows error state on AI 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 502 })))
    render(<SummarizePill text="Body text" onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /summarize/i }))
    await waitFor(() => expect(screen.getByText(/couldn't summarize/i)).toBeInTheDocument())
  })

  it('is disabled while a request is in flight', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))   // never resolves
    render(<SummarizePill text="Body text" onSummary={() => {}} />)
    const btn = screen.getByRole('button', { name: /summarize/i })
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/reader.summarize.test.tsx
```
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `SummarizePill.tsx`**

Create `apps/desktop/src/reader-app/SummarizePill.tsx`:

```tsx
import { useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? 'https://baobab-api.ohcsghana-main.workers.dev'

export interface SummarizePillProps {
  text: string
  onSummary: (summary: string) => void
}

export function SummarizePill({ text, onSummary }: SummarizePillProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClick = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 6000) }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json() as { summary?: string; response?: string }
      const summary = json.summary ?? json.response ?? ''
      if (!summary) throw new Error('empty')
      onSummary(summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        style={{
          background: 'rgba(217, 164, 90, 0.18)',
          color: 'var(--accent)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          marginLeft: 8,
        }}
      >
        {loading ? 'Summarizing…' : '+ Summarize'}
      </button>
      {error && (
        <span role="alert" style={{ marginLeft: 8, fontSize: 11, color: 'var(--critical)' }}>
          Couldn't summarize — try again later.
        </span>
      )}
    </>
  )
}
```

- [ ] **Step 4: Wire SummarizePill into ReaderApp**

Edit `apps/desktop/src/reader-app/ReaderApp.tsx`. Add import:

```tsx
import { SummarizePill } from './SummarizePill'
```

Add a `summary` state next to the other state declarations:

```tsx
const [summary, setSummary] = useState<string>('')
```

In the render block, change the header to include the pill and the summary slot. Find:

```tsx
<header style={...}>
  <span>📖 saved ≈ ...</span>
  <a href={urlParam} ...>Load full page</a>
</header>
```

Replace with:

```tsx
<header style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
  <span>📖 saved ≈ {formatMb(data.bytes_saved + data.bytes_saved_adblock)} · {data.est_read_minutes} min read · {data.ads_blocked} ads blocked</span>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    {!data.ai_summary && !summary && (
      <SummarizePill text={data.text} onSummary={setSummary} />
    )}
    <a href={urlParam} style={{ color: 'var(--accent)', textDecoration: 'none' }}>Load full page</a>
  </span>
</header>
{(data.ai_summary || summary) && (
  <aside style={{ background: 'var(--surface-1)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, border: '1px solid var(--border)' }}>
    <strong style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>AI summary</strong>
    <p style={{ margin: '6px 0 0', color: 'var(--text-primary)', fontSize: 13.5 }}>{data.ai_summary || summary}</p>
  </aside>
)}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/reader.summarize.test.tsx tests/reader.app.test.tsx
```
Expected: PASS — all tests across both files green.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/reader-app/SummarizePill.tsx apps/desktop/src/reader-app/ReaderApp.tsx apps/desktop/tests/reader.summarize.test.tsx
git commit -m "feat(reader): SummarizePill — opt-in AI summary on reader.html

Hidden when the worker already returned an ai_summary; visible when
skip_ai sent. Click hits /api/ai/summarize with up to 6000 chars of
article text and renders the response in the AI-summary slot above the
article.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Omnibar integration — intercept on submit + render ReaderPill

**Files:**
- Modify: `apps/desktop/src/chrome/Omnibar.tsx`
- Create: `apps/desktop/tests/omnibar.reader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/tests/omnibar.reader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react'
import { useConnectionStore } from '~/state/connection.store'
import { useTabsStore } from '~/state/tabs.store'
import { __resetInterceptOverridesForTest } from '~/reader/intercept'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => ({ id: 't1', url: 'about:blank' })),
  ipcCloseTab: vi.fn(async () => undefined),
  ipcShowTab: vi.fn(async () => undefined),
  ipcHideTab: vi.fn(async () => undefined),
  ipcNavigateTab: vi.fn(async () => undefined),
  ipcListTabs: vi.fn(async () => []),
  ipcTabGoBack: vi.fn(async () => undefined),
  ipcTabGoForward: vi.fn(async () => undefined),
  onTabLoaded: () => () => {},
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ close: vi.fn(), minimize: vi.fn(), toggleMaximize: vi.fn(), startDragging: vi.fn() }),
}))
vi.mock('~/history/omnibar-autocomplete', () => ({ suggest: vi.fn(async () => []) }))

import { Omnibar } from '~/chrome/Omnibar'
import { ipcNavigateTab } from '~/ipc/tabs'

beforeEach(() => {
  vi.clearAllMocks()
  __resetInterceptOverridesForTest()
  useConnectionStore.setState({
    effectiveType: '2g', type: 'cellular', isOffline: false, isSlow: true,
    slowModeForced: false, downlinkMbps: 0, saveData: false,
  })
  useTabsStore.setState({
    tabs: [{ id: 't1', url: 'about:blank', title: '', pinned: false, active: true, loading: false, lastVisitedAt: 0 }],
    activeId: 't1',
    history: { t1: { depth: 0, max: 0 } },
  })
})

describe('Omnibar Bundle-B integration', () => {
  it('on slow + non-skip URL, opens the countdown before navigating', async () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('dialog', { name: /heavy page/i })).toBeInTheDocument())
    expect(ipcNavigateTab).not.toHaveBeenCalled()
  })

  it('on slow + non-skip URL, accepting countdown navigates to reader.html?url=…', async () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /open now/i }))
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    const [, url] = (ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('/reader.html?url=')
    expect(url).toContain(encodeURIComponent('https://example.com/article'))
  })

  it('on slow + non-skip URL, cancelling the countdown navigates to the original URL', async () => {
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    const [, url] = (ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://example.com/article')
  })

  it('on wifi, no countdown — navigates directly', async () => {
    useConnectionStore.setState({ effectiveType: '4g', type: 'wifi', isSlow: false })
    render(<Omnibar />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/article' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    const [, url] = (ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://example.com/article')
  })

  it('renders ReaderPill when active tab url is a reader.html URL', () => {
    useTabsStore.setState({
      tabs: [{
        id: 't1',
        url: 'tauri://localhost/reader.html?url=' + encodeURIComponent('https://example.com/article'),
        title: '', pinned: false, active: true, loading: false, lastVisitedAt: 0,
      }],
      activeId: 't1',
    })
    render(<Omnibar />)
    expect(screen.getByRole('button', { name: /reader/i })).toBeInTheDocument()
  })

  it('clicking the pill navigates to the original URL', async () => {
    useTabsStore.setState({
      tabs: [{
        id: 't1',
        url: 'tauri://localhost/reader.html?url=' + encodeURIComponent('https://example.com/article'),
        title: '', pinned: false, active: true, loading: false, lastVisitedAt: 0,
      }],
      activeId: 't1',
    })
    render(<Omnibar />)
    fireEvent.click(screen.getByRole('button', { name: /reader/i }))
    await waitFor(() => expect(ipcNavigateTab).toHaveBeenCalled())
    expect((ipcNavigateTab as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('https://example.com/article')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/omnibar.reader.test.tsx
```
Expected: FAIL — the Omnibar doesn't have the intercept/pill wiring yet.

- [ ] **Step 3: Add intercept + pill to Omnibar**

Edit `apps/desktop/src/chrome/Omnibar.tsx`. Add imports at the top:

```ts
import { useState as useReactState } from 'react'
import {
  shouldInterceptNavigation,
  markUserOverride,
  buildReaderUrl,
  parseReaderUrl,
} from '~/reader/intercept'
import { CountdownModal } from '~/reader/CountdownModal'
import { ReaderPill } from '~/reader/ReaderPill'
```

Inside the `Omnibar` component, add a local pending-countdown state:

```tsx
const [pendingCountdown, setPendingCountdown] = useReactState<string | null>(null)
```

Find the existing submit handler (the function passed to `onKeyDown` that handles `Enter`). Wrap the URL submit branch (`if (parsed.kind === 'url')` path) so that:

```tsx
if (parsed.kind === 'url') {
  if (!isNavigableUrl(parsed.url)) {
    const searchUrl = `${SEARCH_BASE_URL}?q=${encodeURIComponent(value)}`
    if (activeId) void navigate(activeId, searchUrl)
    blur()
    return
  }
  if (shouldInterceptNavigation(parsed.url)) {
    setPendingCountdown(parsed.url)
    blur()
    return
  }
  if (activeId) void navigate(activeId, parsed.url)
  blur()
  return
}
```

Add the modal render at the bottom of the Omnibar return, after the rest of the JSX:

```tsx
{pendingCountdown && (
  <CountdownModal
    url={pendingCountdown}
    onAccept={() => {
      const url = pendingCountdown
      setPendingCountdown(null)
      if (activeId) void navigate(activeId, buildReaderUrl(url))
    }}
    onCancel={() => {
      const url = pendingCountdown
      setPendingCountdown(null)
      markUserOverride(url)
      if (activeId) void navigate(activeId, url)
    }}
  />
)}
```

For the ReaderPill — derive the original-URL state from the active tab. Find where the URL value is shown in the omnibar input. Right before the input, render the pill conditionally:

```tsx
const activeTab = tabs.find((t) => t.id === activeId)
const readerOriginal = activeTab ? parseReaderUrl(activeTab.url) : null
```

Then in the input row, conditionally render the pill (replace what's currently the leading area of the input):

```tsx
{readerOriginal && (
  <ReaderPill
    onLoadFullPage={() => {
      markUserOverride(readerOriginal)
      if (activeId) void navigate(activeId, readerOriginal)
    }}
  />
)}
```

Update the `urlForDisplay` (or the equivalent display-decoder) so reader-URL active tabs show the **original** URL in the omnibar input. Find `urlForDisplay` (search-portal already has a similar one for `SEARCH_URL_RE`); add a parallel `readerMatch = parseReaderUrl(url)` early-return that returns the decoded URL when matched.

If `urlForDisplay` already exists for search.html, add a new branch:

```ts
function urlForDisplay(url: string | undefined): string {
  if (!url) return ''
  if (url === 'about:blank') return ''
  const reader = parseReaderUrl(url)
  if (reader) return reader
  const m = url.match(SEARCH_URL_RE)
  if (m && m[1] !== undefined) {
    try { return decodeURIComponent(m[1]) } catch { return m[1] }
  }
  return url
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/omnibar.reader.test.tsx
```
Expected: PASS — 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/chrome/Omnibar.tsx apps/desktop/tests/omnibar.reader.test.tsx
git commit -m "feat(reader): omnibar gates submit through countdown + renders ReaderPill

On slow-mode non-skip URLs: omnibar Enter pops the countdown instead of
navigating directly. Accept → ipcNavigateTab(reader.html?url=…). Cancel →
navigate to original + arm the 5-min override.

When the active tab is a reader.html URL, the omnibar input shows the
ORIGINAL URL (via urlForDisplay parsing READER_URL_RE) and a ReaderPill
sits next to it. Click pill → load full page + 5-min override.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: TabStrip integration — gate at Duplicate

**Files:**
- Modify: `apps/desktop/src/chrome/TabStrip.tsx`
- Create: `apps/desktop/tests/tabstrip.reader.test.tsx`

**Context:** TabStrip has exactly one URL-bearing nav path: the right-click → **Duplicate** action. Other paths (`+` button, `openTabAfter(..., 'about:blank')`, the "New tab" context-menu item) all open blank tabs and need no gating. The Duplicate action currently routes through `useTabsStore.getState().duplicateTab(targetId)`, which reads the target tab's URL and opens a new tab with it. We intercept that read.

- [ ] **Step 1: Confirm the Duplicate path**

```bash
grep -n "duplicate" src/chrome/TabStrip.tsx
```

Expected: the `case 'duplicate':` handler around line 419 calls `void duplicateTab(tabId)`. That is our single intercept point.

- [ ] **Step 2: Write the failing test**

Create `apps/desktop/tests/tabstrip.reader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { useConnectionStore } from '~/state/connection.store'
import { useTabsStore } from '~/state/tabs.store'
import { __resetInterceptOverridesForTest } from '~/reader/intercept'

vi.mock('~/ipc/tabs', () => ({
  ipcCreateTab: vi.fn(async () => ({ id: 't2', url: 'about:blank' })),
  ipcCloseTab: vi.fn(),
  ipcShowTab: vi.fn(),
  ipcHideTab: vi.fn(),
  ipcNavigateTab: vi.fn(),
  ipcListTabs: vi.fn(async () => []),
  ipcTabGoBack: vi.fn(), ipcTabGoForward: vi.fn(),
  onTabLoaded: () => () => {},
}))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ close: vi.fn(), minimize: vi.fn(), toggleMaximize: vi.fn(), startDragging: vi.fn() }),
}))
// The native context menu in TabStrip routes through this module — mock it so the
// test can fire a "duplicate" selection synchronously.
let nextMenuResolve: ((id: string | null) => void) | null = null
vi.mock('~/ipc/menus', () => ({
  showContextMenu: vi.fn(() => new Promise<string | null>((r) => { nextMenuResolve = r })),
}))

import { TabStrip } from '~/chrome/TabStrip'

const tabAt = (url: string) => ({
  id: 't1', url, title: 'A', pinned: false, active: true, loading: false, lastVisitedAt: 0,
})

beforeEach(() => {
  vi.clearAllMocks()
  __resetInterceptOverridesForTest()
  nextMenuResolve = null
  useConnectionStore.setState({
    effectiveType: '2g', type: 'cellular', isOffline: false, isSlow: true,
    slowModeForced: false, downlinkMbps: 0, saveData: false,
  })
})

describe('TabStrip duplicate gating', () => {
  it('opens countdown when duplicating a heavy URL on slow', async () => {
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')
    const openTabAfter = vi.spyOn(useTabsStore.getState(), 'openTabAfter')

    render(<TabStrip />)
    // Trigger the tab's context menu — fire on the tab pill
    fireEvent.contextMenu(screen.getByText('A'))
    // Resolve the menu with "duplicate"
    nextMenuResolve!('duplicate')

    await waitFor(() => expect(screen.getByRole('dialog', { name: /heavy page/i })).toBeInTheDocument())
    expect(duplicateTab).not.toHaveBeenCalled()
    expect(openTabAfter).not.toHaveBeenCalled()
  })

  it('on accept, opens a new tab pointing at reader.html?url=…', async () => {
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const openTabAfter = vi.spyOn(useTabsStore.getState(), 'openTabAfter')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /open now/i }))

    await waitFor(() => expect(openTabAfter).toHaveBeenCalled())
    const args = openTabAfter.mock.calls[0]
    expect(args[0]).toBe('t1')
    expect(args[1]).toContain('/reader.html?url=')
    expect(args[1]).toContain(encodeURIComponent('https://example.com/article'))
  })

  it('on cancel, falls back to a normal duplicateTab', async () => {
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() => expect(duplicateTab).toHaveBeenCalledWith('t1'))
  })

  it('on wifi, no countdown — duplicateTab called directly', async () => {
    useConnectionStore.setState({ effectiveType: '4g', type: 'wifi', isSlow: false })
    useTabsStore.setState({
      tabs: [tabAt('https://example.com/article')],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')

    await waitFor(() => expect(duplicateTab).toHaveBeenCalledWith('t1'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('skips countdown when duplicating an already-reader-mode tab', async () => {
    useTabsStore.setState({
      tabs: [tabAt('tauri://localhost/reader.html?url=' + encodeURIComponent('https://example.com/x'))],
      activeId: 't1',
      history: { t1: { depth: 0, max: 0 } },
    })
    const duplicateTab = vi.spyOn(useTabsStore.getState(), 'duplicateTab')

    render(<TabStrip />)
    fireEvent.contextMenu(screen.getByText('A'))
    nextMenuResolve!('duplicate')

    // The URL is `tauri://localhost/reader.html?...` — not http(s), so shouldIntercept returns false.
    await waitFor(() => expect(duplicateTab).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run tests/tabstrip.reader.test.tsx
```
Expected: FAIL — duplicate flow doesn't gate yet.

- [ ] **Step 4: Wire the gate into TabStrip's duplicate handler**

Edit `apps/desktop/src/chrome/TabStrip.tsx`. Add imports near the top:

```ts
import { shouldInterceptNavigation, buildReaderUrl, markUserOverride } from '~/reader/intercept'
import { CountdownModal } from '~/reader/CountdownModal'
```

Inside the `TabStrip` component, add state for the pending countdown (this should sit near the other `useState` hooks already in the component):

```ts
const [pendingDup, setPendingDup] = useState<{ url: string; targetId: string } | null>(null)
```

Find the existing `case 'duplicate':` handler (around line 419). Replace:

```ts
case 'duplicate':    void duplicateTab(tabId); break
```

With:

```ts
case 'duplicate': {
  const target = useTabsStore.getState().tabs.find((t) => t.id === tabId)
  const targetUrl = target?.url ?? ''
  if (shouldInterceptNavigation(targetUrl)) {
    setPendingDup({ url: targetUrl, targetId: tabId })
  } else {
    void duplicateTab(tabId)
  }
  break
}
```

At the bottom of the component's return JSX (sibling to whatever the current return wraps), render the modal:

```tsx
{pendingDup && (
  <CountdownModal
    url={pendingDup.url}
    onAccept={() => {
      const p = pendingDup
      setPendingDup(null)
      void openTabAfter(p.targetId, buildReaderUrl(p.url))
    }}
    onCancel={() => {
      const p = pendingDup
      setPendingDup(null)
      markUserOverride(p.url)
      void duplicateTab(p.targetId)
    }}
  />
)}
```

(`openTabAfter` and `duplicateTab` are already destructured from `useTabsStore` at the top of the component — no new selectors needed.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/tabstrip.reader.test.tsx
```
Expected: PASS — 5 tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/chrome/TabStrip.tsx apps/desktop/tests/tabstrip.reader.test.tsx
git commit -m "feat(reader): TabStrip duplicate gates through countdown on slow mode

Right-click → Duplicate is the only URL-bearing nav path in TabStrip
(everything else opens about:blank). On slow mode with a non-skip-list
target URL, the duplicate fires the same CountdownModal as the omnibar.
Accept → openTabAfter(target, buildReaderUrl(url)); Cancel → normal
duplicateTab + 5-min override. Already-reader-mode tabs bypass (the
URL is tauri:// scheme — non-http, intercept returns false).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Worker CORS verification

**Files:**
- Modify (only if missing): `worker/src/index.ts`

- [ ] **Step 1: Verify the existing CORS allowlist includes reader's origin**

```bash
grep -n "CORS_ORIGIN\|tauri://localhost\|localhost:1420" worker/src/index.ts worker/wrangler.toml
```

The search portal already required these. Reader uses the same Tauri webview origins, so likely no change.

- [ ] **Step 2: If missing, add and commit**

If `tauri://localhost` and `http://localhost:1420` are not in `CORS_ORIGIN`, add them. Otherwise this task is a no-op — record a commit-free skip in the next task's commit message.

```bash
# Only if a change was needed:
git add worker/src/index.ts worker/wrangler.toml
git commit -m "chore(worker): confirm reader.html origin in CORS allowlist"
```

---

## Task 13: Manual smoke run + acceptance checklist

**Files:** (none modified — this is verification)

- [ ] **Step 1: Full typecheck + test sweep**

```bash
cd apps/desktop && npx tsc --noEmit
cd apps/desktop && npx vitest run
cd ../../worker && npx vitest run
cd ../apps/desktop/src-tauri && cargo test
```
Expected: all green. (The pre-existing `a11y.audit.test.tsx` OOM is a known Bundle A issue — not a Bundle B regression. If it surfaces, file separately.)

- [ ] **Step 2: Manual smoke procedure**

Run the dev app: `cd apps/desktop && npm run tauri dev`. In the app:

1. **Slow mode + heavy URL** — DevTools throttle to Slow 3G (or use the Force-slow-mode toggle in Settings → Data). Type `https://www.nytimes.com/section/world` in the omnibar and press Enter.
   - [ ] Countdown modal appears immediately
   - [ ] Countdown ticks 3 → 2 → 1
   - [ ] On elapse, tab navigates to `reader.html?url=…`
   - [ ] Article body renders within ~1s
   - [ ] Header shows `📖 saved ≈ <number> MB`
   - [ ] Omnibar shows the **original** URL, with a `📖 Reader` pill next to it
2. **Pill click** — Click the `📖 Reader` pill.
   - [ ] Tab navigates to the original URL (full page)
   - [ ] Type the same URL again → countdown does NOT fire (5-min override active)
3. **Skip-list** — Type `gmail.com` then `https://github.com/owner/repo` then `https://example.com/login`.
   - [ ] None of these open the countdown
4. **Wifi (or Force-slow OFF)** — In Settings → Data, turn off Force-slow-mode. Type a heavy URL.
   - [ ] No countdown; navigates directly
5. **`+ Summarize`** — Open a reader.html page, click the `+ Summarize` pill.
   - [ ] Summary text appears in the AI-summary slot above the article
6. **Gauge integration** — In Settings → Data, observe the gauge before and after a couple of Reader fetches.
   - [ ] Gauge `bytesSaved` tick increases by the reported `saved ≈ …` amounts
7. **Error fall-through** — Try a URL the worker can't fetch (e.g. an offline-only page or a blocked-UA site).
   - [ ] reader.html shows the error pane with a "Load full page" link

Document any failure with a screenshot/note. Acceptance criteria #1–9 from the spec map 1:1 to these checks.

- [ ] **Step 3: Push the branch**

```bash
git push origin feat/desktop-p0b
```

- [ ] **Step 4: Final commit (optional — only if there are post-smoke fixups)**

If smoke surfaced bugs:

```bash
# fix each, commit individually, then push
git push origin feat/desktop-p0b
```

If smoke was clean, no extra commit needed — Tasks 1–11 (and possibly 12) already pushed.

---

## Task 14: Update progress-state memory + extend PR description

**Files:** (memory + PR — not in the repo)

- [ ] **Step 1: Update progress_state.md**

Update `C:\Users\USER\.claude\projects\C--dev-baobab\memory\progress_state.md`'s top section to reflect that Bundle B has shipped, list the new commits, and roll up the manual-smoke outcomes. Move the brainstorm trail to "Earlier this session" framing.

- [ ] **Step 2: Update PR #1 description**

If PR #1 is still the canonical target, append a Bundle B section to its body. Otherwise discuss with the user whether Bundle B warrants its own PR.

---

## Self-review notes (already applied — see spec self-review log)

- Spec coverage: every section in the spec maps to a task above (factorFor → T1, public route → T2, bytes_saved → T3, intercept → T4 + T7, CountdownModal → T5, ReaderPill → T6, reader.html → T8, SummarizePill → T9, Omnibar → T10, TabStrip → T11, CORS → T12, manual smoke → T13).
- Type consistency: `shouldInterceptNavigation`, `markUserOverride`, `__resetInterceptOverridesForTest`, `buildReaderUrl`, `parseReaderUrl`, `READER_BASE_URL`, `READER_URL_RE` all defined in T4 + T7 and referenced consistently. `ReaderResponse` fields match worker output. `record_tab_usage` payload shape (`{ bytesUsed, bytesSaved }`) matches `usage.rs`. `factorFor`'s return type (`number`) is consistent.
- Placeholder scan: no "TBD"/"TODO" steps. The single `it.todo` in T11 is annotated with the converter step (T11 step 4); deliberate.
- The v1.x Rust `on_navigation` hook is intentionally out of scope and tracked in the spec's "Open items"; no task here.
