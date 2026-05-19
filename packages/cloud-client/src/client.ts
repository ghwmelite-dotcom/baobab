export class ApiError extends Error {
  override name = 'ApiError'
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message)
  }
}

export interface ClientOptions {
  baseUrl: string
  /** Inject for tests; defaults to global `fetch`. */
  fetch?: typeof fetch
  /** Per-request timeout in ms. Default 15_000. Pass 0 to disable. */
  timeoutMs?: number
  /** Called on 401. Return a fresh access token to retry once, or null to give up. */
  onUnauthorized?: () => Promise<string | null>
}

export class BaobabClient {
  private accessToken: string | null = null
  private readonly fetchFn: typeof fetch
  private readonly defaultTimeoutMs: number

  constructor(private readonly opts: ClientOptions) {
    // Bind to globalThis: holding fetch as an instance property and calling
    // `this.fetchFn(...)` would otherwise bind `this` to BaobabClient, which
    // browsers reject with "Illegal invocation". Same pattern as the adblock
    // engine.js fix.
    this.fetchFn = opts.fetch ?? globalThis.fetch.bind(globalThis)
    this.defaultTimeoutMs = opts.timeoutMs ?? 15_000
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  /** Underlying request. Returns the raw Response so callers can read headers. */
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`)
    if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
    const url = this.opts.baseUrl.replace(/\/$/, '') + path

    const controller = new AbortController()
    const timer =
      this.defaultTimeoutMs > 0 ? setTimeout(() => controller.abort(), this.defaultTimeoutMs) : null
    // Forward caller's abort signal too.
    if (init.signal) {
      if (init.signal.aborted) controller.abort()
      else init.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      let r = await this.fetchFn(url, { ...init, headers, signal: controller.signal })
      if (r.status === 401 && this.opts.onUnauthorized) {
        const newToken = await this.opts.onUnauthorized()
        if (newToken) {
          this.accessToken = newToken
          const retryHeaders = new Headers(init.headers)
          retryHeaders.set('Authorization', `Bearer ${newToken}`)
          if (init.body && !retryHeaders.has('Content-Type'))
            retryHeaders.set('Content-Type', 'application/json')
          r = await this.fetchFn(url, { ...init, headers: retryHeaders, signal: controller.signal })
        }
      }
      return r
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  async getJson<T>(path: string): Promise<T> {
    const r = await this.request(path, { method: 'GET' })
    if (!r.ok) {
      const body = await safeJson(r)
      throw new ApiError(`${r.status} ${r.statusText}`, r.status, body)
    }
    return (await r.json()) as T
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const r = await this.request(path, { method: 'POST', body: JSON.stringify(body) })
    if (!r.ok) {
      const errBody = await safeJson(r)
      throw new ApiError(`${r.status} ${r.statusText}`, r.status, errBody)
    }
    return (await r.json()) as T
  }
}

async function safeJson(r: Response): Promise<unknown> {
  try {
    return await r.json()
  } catch {
    return null
  }
}
