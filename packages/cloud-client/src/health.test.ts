import { describe, it, expect, vi } from 'vitest'
import { BaobabClient } from './client'
import { probeHealth } from './health'

describe('probeHealth', () => {
  it('returns parsed residency from response headers', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: {
            'X-Baobab-Colo': 'LOS',
            'X-Baobab-Region': 'africa',
            'X-Data-Residency': 'd1=weur,r2=eu',
          },
        }),
    )
    const client = new BaobabClient({ baseUrl: 'https://x', fetch: fetchMock })
    const r = await probeHealth(client)
    expect(r.ok).toBe(true)
    expect(r.residency).toEqual({ colo: 'LOS', region: 'africa', dataResidency: 'd1=weur,r2=eu' })
  })
})
