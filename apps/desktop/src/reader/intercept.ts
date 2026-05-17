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
  // Explicit "never" override beats detection — escape hatch when WebView2 misreports.
  if (s.slowModeOverride === 'never') return false
  // Otherwise: only intercept when detection says slow OR user forced always-on.
  if (s.slowModeOverride !== 'always' && !s.isSlow) return false

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
