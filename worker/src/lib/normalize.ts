// Boundary normalization for user-supplied identifiers. Apply at the API
// edge BEFORE any DB lookup or write, otherwise duplicate signups and
// fragmented histories are inevitable (`Alice@x.com` vs `alice@x.com`,
// `+233 24 111 2222` vs `+233241112222`).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Accepts unknown so route handlers can pass JSON-parsed body fields directly
// without a separate typeof guard. JSON-via-readJson can produce numbers,
// arrays, or objects under attacker control; non-strings normalize to null
// rather than throwing.
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const e = input.trim().toLowerCase()
  return EMAIL_RE.test(e) ? e : null
}

// Strict E.164: + sign followed by 8-15 digits (ITU-T E.164 recommends 15 max).
// First digit after + must be 1-9 (no leading zero on country code).
const E164_RE = /^\+[1-9]\d{7,14}$/

export function normalizePhoneE164(input: unknown): string | null {
  if (typeof input !== 'string') return null
  // Strip spaces, dashes, parentheses, dots — common formatting noise.
  const stripped = input.replace(/[\s\-().]/g, '')
  return E164_RE.test(stripped) ? stripped : null
}

// Convenience for callers that have a country and want to coerce a local
// number (e.g. Ghana 024xxxxxxx) into E.164 (+233 + drop-leading-zero).
const COUNTRY_PREFIXES: Record<string, string> = {
  GH: '233',
  NG: '234',
  KE: '254',
  ZA: '27',
  UG: '256',
  TZ: '255',
  RW: '250',
  ET: '251',
  CI: '225',
  SN: '221',
  EG: '20',
  MA: '212',
  DZ: '213',
  TN: '216',
  AO: '244',
  CD: '243',
  ZM: '260',
  ZW: '263',
  BW: '267',
  NA: '264',
  MZ: '258',
}

export function toE164(input: unknown, country: string): string | null {
  if (typeof input !== 'string') return null
  const direct = normalizePhoneE164(input)
  if (direct) return direct

  const prefix = COUNTRY_PREFIXES[country.toUpperCase()]
  if (!prefix) return null

  const digits = input.replace(/\D/g, '').replace(/^0+/, '')
  return normalizePhoneE164(`+${prefix}${digits}`)
}
