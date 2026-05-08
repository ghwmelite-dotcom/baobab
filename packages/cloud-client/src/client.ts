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
}

export class BaobabClient {
  private accessToken: string | null = null
  private readonly fetchFn: typeof fetch

  constructor(private readonly opts: ClientOptions) {
    this.fetchFn = opts.fetch ?? globalThis.fetch
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
    return this.fetchFn(url, { ...init, headers })
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
