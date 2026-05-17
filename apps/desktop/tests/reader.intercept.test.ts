import { describe, it, expect, beforeEach, vi } from 'vitest'
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
