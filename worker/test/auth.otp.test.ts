import { describe, expect, it } from 'vitest'
import { SELF, env } from 'cloudflare:test'

describe('POST /api/auth/otp/send', () => {
  it('rejects invalid phone (400)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'notaphone' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects missing phone (400)', async () => {
    const res = await SELF.fetch('http://baobab/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('stores OTP in KV for valid phone (200, dev_code returned in development)', async () => {
    const phone = '+233241000001'
    const res = await SELF.fetch('http://baobab/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean; dev_code?: string }
    expect(body.ok).toBe(true)
    // No SMS provider creds in test env -> dev_code returned in development.
    expect(body.dev_code).toMatch(/^\d{6}$/)
    // OTP should be stored in KV.
    const stored = await env.OTP.get(`otp:${phone}`)
    expect(stored).toBeTruthy()
  })

  it('rate-limits to 3 sends per hour per phone (429 after the 4th)', async () => {
    const phone = '+233241000099'
    for (let i = 0; i < 3; i++) {
      const r = await SELF.fetch('http://baobab/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      expect(r.status).toBe(200)
    }
    const fourth = await SELF.fetch('http://baobab/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    expect(fourth.status).toBe(429)
  })
})
