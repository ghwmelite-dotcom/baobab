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
