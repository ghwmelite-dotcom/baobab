import { describe, it, expect, vi } from 'vitest'
import { BaobabClient } from './client'
import { AuthClient } from './auth'

describe('AuthClient', () => {
  it('signup posts email+password and returns access', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response(JSON.stringify({ access: 'jwt', refresh: 'rt' }), { status: 200 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x', fetch: fetchMock })
    const auth = new AuthClient(client)
    const r = await auth.signupEmail('a@b.com', 'long-password-123')
    expect(r.access).toBe('jwt')
    expect(r.refresh).toBe('rt')
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.com', password: 'long-password-123' })
  })

  it('refreshes the access token using the refresh token', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(
      async () => new Response(JSON.stringify({ access: 'new-jwt' }), { status: 200 }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x', fetch: fetchMock })
    const auth = new AuthClient(client)
    const r = await auth.refresh('rt-old')
    expect(r.access).toBe('new-jwt')
  })
})
