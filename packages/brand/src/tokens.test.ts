import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { darkTokens, lightTokens, groveTokens, typography } from './tokens'

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
  it('exposes textOnAccent for primary buttons in both themes', () => {
    expect(darkTokens.textOnAccent).toBe('#15110d')
    expect(lightTokens.textOnAccent).toBe('#faf6ee')
  })
})

describe('groveTokens ↔ tokens.css parity', () => {
  // Drift check: every value declared in `groveTokens` must appear verbatim in
  // the @baobab/ui tokens.css block. Catches the easy class of bug where
  // someone updates one side and forgets the other. Asserts value parity, not
  // naming parity — the CSS var names differ from TS keys
  // (skyDawn ↔ --grove-sky-dawn).
  const cssPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/src/theme/tokens.css',
  )
  const css = readFileSync(cssPath, 'utf8')

  it.each(Object.entries(groveTokens))(
    'groveTokens.%s value appears in tokens.css',
    (_key, value) => {
      expect(css).toContain(value)
    },
  )
})
