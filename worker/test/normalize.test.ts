import { describe, expect, it } from 'vitest'
import { normalizeEmail, normalizePhoneE164, toE164 } from '../src/lib/normalize'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Alice@Example.COM  ')).toBe('alice@example.com')
  })
  it('rejects malformed input', () => {
    expect(normalizeEmail('notanemail')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('a @b.c')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
  })
})

describe('normalizePhoneE164', () => {
  it('strips formatting and accepts E.164', () => {
    expect(normalizePhoneE164('+233 24 111 2222')).toBe('+233241112222')
    expect(normalizePhoneE164('+233-24-111-2222')).toBe('+233241112222')
    expect(normalizePhoneE164('+233(24)111.2222')).toBe('+233241112222')
  })
  it('rejects no plus sign', () => {
    expect(normalizePhoneE164('233241112222')).toBeNull()
  })
  it('rejects leading zero after plus', () => {
    expect(normalizePhoneE164('+023241112222')).toBeNull()
  })
  it('rejects too short / too long', () => {
    expect(normalizePhoneE164('+1234567')).toBeNull()      // 7 digits — under min 8
    expect(normalizePhoneE164('+1234567890123456')).toBeNull() // 16 digits — over 15
  })
})

describe('toE164', () => {
  it('passes through E.164 unchanged', () => {
    expect(toE164('+233241112222', 'GH')).toBe('+233241112222')
  })
  it('coerces Ghana local format', () => {
    expect(toE164('024 111 2222', 'GH')).toBe('+233241112222')
    expect(toE164('0241112222', 'gh')).toBe('+233241112222')
  })
  it('coerces Nigeria local format', () => {
    expect(toE164('08012345678', 'NG')).toBe('+2348012345678')
  })
  it('returns null for unknown country', () => {
    expect(toE164('0241112222', 'XX')).toBeNull()
  })
})
