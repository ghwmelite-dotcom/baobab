import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: vi.fn(), unmount: vi.fn() })),
}))

vi.mock('~/App', () => ({
  App: (): null => null,
}))

vi.mock('~/error/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: unknown }): unknown => children,
}))

describe('main.tsx Sentry init', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    const root = document.createElement('div')
    root.id = 'root'
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllEnvs()
  })

  it('calls Sentry.init when VITE_SENTRY_DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://abc@o0.ingest.sentry.io/1')
    vi.stubEnv('MODE', 'production')

    const Sentry = await import('@sentry/react')
    await import('~/main')

    expect(Sentry.init).toHaveBeenCalledTimes(1)
    const call = vi.mocked(Sentry.init).mock.calls[0]?.[0]
    expect(call?.dsn).toBe('https://abc@o0.ingest.sentry.io/1')
    expect(call?.environment).toBe('production')
    expect(call?.tracesSampleRate).toBe(0)
    expect(call?.replaysSessionSampleRate).toBe(0)
  })

  it('does NOT call Sentry.init when VITE_SENTRY_DSN is empty', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')

    const Sentry = await import('@sentry/react')
    await import('~/main')

    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('does NOT call Sentry.init when VITE_SENTRY_DSN is absent', async () => {
    // Intentionally do not stub VITE_SENTRY_DSN — it is unset in the test env.
    const Sentry = await import('@sentry/react')
    await import('~/main')

    expect(Sentry.init).not.toHaveBeenCalled()
  })
})
