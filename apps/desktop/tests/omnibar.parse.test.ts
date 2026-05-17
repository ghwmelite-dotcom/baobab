import { describe, it, expect } from 'vitest'
import { parseOmnibarInput } from '@baobab/core'

// Sanity check that the renderer can import the core parser.
describe('omnibar uses core parser', () => {
  it('routes example.com to URL', () => {
    expect(parseOmnibarInput('example.com')).toEqual({ kind: 'url', url: 'https://example.com' })
  })
  it('routes natural language to search', () => {
    expect(parseOmnibarInput('best jollof recipes')).toEqual({
      kind: 'search',
      query: 'best jollof recipes',
    })
  })
})
