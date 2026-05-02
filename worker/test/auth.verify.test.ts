import { describe, expect, it } from 'vitest'
import { SELF, env } from 'cloudflare:test'
import { storeOtp } from '../src/services/otp'

describe('POST /api/auth/otp/verify', () => {
  it('returns tokens for correct OTP and creates user if new', async () => {
    const phone = '+233241000010'
    await storeOtp(env.OTP, phone, '777777')
    const res = await SELF.fetch('http://baobab/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: '777777' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      access: string
      refresh: string
      user: { id: string; phone: string }
    }
    expect(body.user.phone).toBe(phone)
    expect(body.access).toBeTruthy()
    expect(body.refresh).toBeTruthy()
    // Issued token should be immediately usable — auth middleware will check
    // session:${jti} which startSession just put in KV. Smoke that here:
    const me = await SELF.fetch('http://baobab/', {
      headers: { Authorization: `Bearer ${body.access}` },
    })
    expect(me.status).toBe(200)
  })

  it('rejects wrong code (401)', async () => {
    const phone = '+233241000011'
    await storeOtp(env.OTP, phone, '777777')
    const res = await SELF.fetch('http://baobab/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: '000000' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects missing phone or code (400)', async () => {
    const r1 = await SELF.fetch('http://baobab/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+233241000012' }),
    })
    expect(r1.status).toBe(400)
    const r2 = await SELF.fetch('http://baobab/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '123456' }),
    })
    expect(r2.status).toBe(400)
  })

  it('reuses existing user on second OTP login (no duplicate row)', async () => {
    const phone = '+233241000013'
    await storeOtp(env.OTP, phone, '111111')
    const r1 = await SELF.fetch('http://baobab/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: '111111' }),
    })
    const u1 = (await r1.json() as { user: { id: string } }).user.id

    await storeOtp(env.OTP, phone, '222222')
    const r2 = await SELF.fetch('http://baobab/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: '222222' }),
    })
    const u2 = (await r2.json() as { user: { id: string } }).user.id

    expect(u1).toBe(u2)
  })
})
