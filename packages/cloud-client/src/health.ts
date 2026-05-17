import type { Residency } from '@baobab/core'
import { parseResidencyHeaders } from '@baobab/core'
import type { BaobabClient } from './client'

export interface HealthResult {
  ok: boolean
  residency: Residency
  raw: unknown
}

export async function probeHealth(client: BaobabClient): Promise<HealthResult> {
  const r = await client.request('/', { method: 'GET' })
  const raw = await r.json().catch(() => ({}))
  return {
    ok: r.ok,
    residency: parseResidencyHeaders(r.headers),
    raw,
  }
}
