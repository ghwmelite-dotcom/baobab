import { describe, it, expect } from 'vitest'
import { darkTokens, lightTokens, typography } from './tokens'

describe('brand tokens', () => {
  it('dark canvas matches Sahel night spec value', () => {
    expect(darkTokens.canvas).toBe('#15110d')
  })
  it('amber accent is the brand color in dark', () => {
    expect(darkTokens.accent).toBe('#d97706')
  })
  it('light theme uses higher-contrast accent', () => {
    expect(lightTokens.accent).toBe('#c2410c')
  })
  it('typography names the spec fonts', () => {
    expect(typography.display).toBe('Recoleta')
    expect(typography.ui).toBe('General Sans')
    expect(typography.reading).toBe('Source Serif 4')
    expect(typography.mono).toBe('JetBrains Mono')
  })
})
