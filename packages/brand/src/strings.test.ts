import { describe, it, expect } from 'vitest'
import { strings } from './strings'

describe('brand voice strings', () => {
  it('tagline matches spec', () => {
    expect(strings.tagline).toBe('The browser that grew here.')
  })
  it('loading copy is sentence not spinner alone', () => {
    expect(strings.loading.aiThinking).toMatch(/[a-z]/i)
    expect(strings.loading.aiThinking.length).toBeGreaterThan(8)
  })
  it('residency labels are single English words', () => {
    expect(strings.residency.home).toBe('Home')
    expect(strings.residency.roaming).toBe('Roaming')
    expect(strings.residency.sovereign).toBe('Sovereign')
  })
})
