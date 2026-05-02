import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

describe('residency middleware', () => {
  it('adds X-Baobab-Region and X-Data-Residency headers on /', async () => {
    const res = await SELF.fetch('http://baobab/')
    expect(res.headers.get('X-Baobab-Region')).toMatch(/africa|edge-fallback|unknown/)
    expect(res.headers.get('X-Data-Residency')).toBe('d1=weur,r2=eu')
  })
})
