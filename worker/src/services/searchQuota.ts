const SOFT_CAP = 9500
const HARD_CAP = 10000

function todayKey(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `pse:quota:${y}-${m}-${day}`
}

export interface QuotaResult {
  allowed: boolean
  fallbackMode?: 'ai-only' | 'quota-degraded'
  remaining: number
}

/** Atomically (best-effort under KV's eventual consistency) increments today's
 *  PSE counter and returns whether a fresh PSE call is allowed plus the
 *  fallback hint for the response. */
export async function consume(kv: KVNamespace): Promise<QuotaResult> {
  const key = todayKey()
  const current = Number((await kv.get(key)) ?? '0')
  const next = current + 1

  if (current >= HARD_CAP) {
    return { allowed: false, fallbackMode: 'ai-only', remaining: 0 }
  }

  await kv.put(key, String(next), { expirationTtl: 60 * 60 * 36 })

  if (next > SOFT_CAP) {
    return { allowed: true, fallbackMode: 'quota-degraded', remaining: HARD_CAP - next }
  }
  return { allowed: true, remaining: HARD_CAP - next }
}
