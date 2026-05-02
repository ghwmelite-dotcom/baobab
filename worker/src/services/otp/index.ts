import type { KVNamespace } from '@cloudflare/workers-types'

const OTP_TTL_SEC = 300       // 5 minutes — long enough for slow SMS, short enough to limit replay window.
const MAX_ATTEMPTS = 5

export function generateCode(): string {
  // 32 random bits -> mod 1_000_000 -> 6-digit zero-padded.
  // The modulo-bias here is < 0.001% per digit (2^32 / 1e6 ≈ 4294.97 ints per
  // 6-digit code). Irrelevant given a 5-attempt cap and one-time use.
  const buf = new Uint8Array(4)
  crypto.getRandomValues(buf)
  const num = (buf[0]! << 24 | buf[1]! << 16 | buf[2]! << 8 | buf[3]!) >>> 0
  return String(num % 1_000_000).padStart(6, '0')
}

export async function storeOtp(kv: KVNamespace, phone: string, code: string): Promise<void> {
  await kv.put(`otp:${phone}`, JSON.stringify({ code, attempts: 0 }), { expirationTtl: OTP_TTL_SEC })
}

export async function verifyOtp(kv: KVNamespace, phone: string, code: string): Promise<boolean> {
  const raw = await kv.get(`otp:${phone}`)
  if (!raw) return false

  let data: { code: string; attempts: number }
  try {
    data = JSON.parse(raw) as { code: string; attempts: number }
  } catch {
    // Tampered or partially-written KV value — treat as missing.
    await kv.delete(`otp:${phone}`)
    return false
  }

  if (typeof data?.code !== 'string' || typeof data?.attempts !== 'number') {
    await kv.delete(`otp:${phone}`)
    return false
  }

  if (data.attempts >= MAX_ATTEMPTS) {
    await kv.delete(`otp:${phone}`)
    return false
  }

  if (data.code !== code) {
    await kv.put(
      `otp:${phone}`,
      JSON.stringify({ code: data.code, attempts: data.attempts + 1 }),
      { expirationTtl: OTP_TTL_SEC }
    )
    return false
  }

  // Success — consume.
  await kv.delete(`otp:${phone}`)
  return true
}

// Send-rate counter: separate from attempt counter on the OTP itself.
// Used by Phase 7 routes to enforce per-phone send rate limits.
export async function recordOtpAttempt(kv: KVNamespace, phone: string): Promise<number> {
  const key = `otp_send_count:${phone}`
  const raw = await kv.get(key)
  const count = raw ? Number(raw) + 1 : 1
  await kv.put(key, String(count), { expirationTtl: 3600 })
  return count
}

export async function getSendCount(kv: KVNamespace, phone: string): Promise<number> {
  const raw = await kv.get(`otp_send_count:${phone}`)
  return raw ? Number(raw) : 0
}
