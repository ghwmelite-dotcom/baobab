import { describe, expect, it } from 'vitest'
import { stripAds } from '../src/services/adblock'

describe('adblock', () => {
  it('removes script tags pointing at ad networks', () => {
    const html = '<html><head><script src="https://googletagmanager.com/x.js"></script></head><body>hi</body></html>'
    const { html: cleaned, ads_blocked } = stripAds(html)
    expect(cleaned).not.toContain('googletagmanager')
    expect(ads_blocked).toBeGreaterThan(0)
  })
  it('keeps inline content intact', () => {
    const html = '<p>important content</p>'
    expect(stripAds(html).html).toContain('important content')
  })
})
