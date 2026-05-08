import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaobabClient } from './client'

describe('BaobabClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('prepends base URL and returns parsed JSON', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response('{"ok":true}', { status: 200 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://api.example.com', fetch: fetchMock })
    const r = await client.getJson<{ ok: boolean }>('/health')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.example.com/health')
    expect(r).toEqual({ ok: true })
  })

  it('attaches Authorization bearer when token is set', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response('{}', { status: 200 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x.test', fetch: fetchMock })
    client.setAccessToken('jwt-abc')
    await client.getJson('/api/me')
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer jwt-abc')
  })

  it('throws ApiError on non-2xx', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response('{"error":"bad"}', { status: 400 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x.test', fetch: fetchMock })
    await expect(client.getJson('/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
    })
  })
})
