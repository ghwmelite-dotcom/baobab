import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { generateCode, storeOtp, verifyOtp, recordOtpAttempt, getSendCount } from '../src/services/otp'

describe('otp — happy path', () => {
  it('generates 6-digit code', () => {
    const code = generateCode()
    expect(code).toMatch(/^\d{6}$/)
  })

  it('stored OTP verifies once and cannot be reused', async () => {
    const phone = '+233241111111'
    const code = '123456'
    await storeOtp(env.OTP, phone, code)
    expect(await verifyOtp(env.OTP, phone, code)).toBe(true)
    expect(await verifyOtp(env.OTP, phone, code)).toBe(false) // already consumed
  })

  it('wrong code returns false', async () => {
    await storeOtp(env.OTP, '+233242222222', '111111')
    expect(await verifyOtp(env.OTP, '+233242222222', '999999')).toBe(false)
  })
})

describe('otp — adversarial', () => {
  it('locks the OTP after MAX_ATTEMPTS wrong tries (correct attempt then fails)', async () => {
    const phone = '+233243333333'
    const code = '424242'
    await storeOtp(env.OTP, phone, code)
    // Burn 5 wrong attempts.
    for (let i = 0; i < 5; i++) {
      expect(await verifyOtp(env.OTP, phone, '000000')).toBe(false)
    }
    // 6th attempt with the correct code must still fail — the OTP is locked.
    expect(await verifyOtp(env.OTP, phone, code)).toBe(false)
  })

  it('returns false for non-existent phone', async () => {
    expect(await verifyOtp(env.OTP, '+233249999999', '123456')).toBe(false)
  })

  it('handles tampered KV value without throwing', async () => {
    const phone = '+233244444444'
    // Write garbage directly under the otp key.
    await env.OTP.put(`otp:${phone}`, 'not valid json')
    await expect(verifyOtp(env.OTP, phone, '123456')).resolves.toBe(false)
  })

  it('generateCode produces distinct codes across many calls', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 1000; i++) codes.add(generateCode())
    // 1000 samples from 1M space — overwhelmingly should all be distinct.
    // (Probability of collision: ~1000^2 / (2 * 1M) ≈ 0.05%; very rarely false-flag.)
    expect(codes.size).toBeGreaterThan(995)
  })

  it('recordOtpAttempt increments and getSendCount reads back', async () => {
    const phone = '+233245555555'
    expect(await getSendCount(env.OTP, phone)).toBe(0)
    expect(await recordOtpAttempt(env.OTP, phone)).toBe(1)
    expect(await recordOtpAttempt(env.OTP, phone)).toBe(2)
    expect(await getSendCount(env.OTP, phone)).toBe(2)
  })
})
