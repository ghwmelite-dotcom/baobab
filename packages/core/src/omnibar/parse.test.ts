import { describe, it, expect } from 'vitest'
import { parseOmnibarInput } from './parse'

describe('parseOmnibarInput', () => {
  it('treats input with a dot and no spaces as a URL', () => {
    expect(parseOmnibarInput('github.com')).toEqual({ kind: 'url', url: 'https://github.com' })
  })
  it('preserves explicit https scheme', () => {
    expect(parseOmnibarInput('https://example.com/path')).toEqual({
      kind: 'url',
      url: 'https://example.com/path',
    })
  })
  it('treats http scheme inputs as URL but keeps the scheme', () => {
    expect(parseOmnibarInput('http://localhost:8787')).toEqual({
      kind: 'url',
      url: 'http://localhost:8787',
    })
  })
  it('treats input with spaces as a search query', () => {
    expect(parseOmnibarInput('bus from accra to kumasi')).toEqual({
      kind: 'search',
      query: 'bus from accra to kumasi',
    })
  })
  it('treats single-word input without a dot as a search', () => {
    expect(parseOmnibarInput('baobab')).toEqual({ kind: 'search', query: 'baobab' })
  })
  it('rejects empty/whitespace input', () => {
    expect(parseOmnibarInput('   ')).toEqual({ kind: 'empty' })
  })
  it('strips leading/trailing whitespace before classifying', () => {
    expect(parseOmnibarInput('  github.com  ')).toEqual({
      kind: 'url',
      url: 'https://github.com',
    })
  })
  it('treats about: scheme as URL', () => {
    expect(parseOmnibarInput('about:blank')).toEqual({ kind: 'url', url: 'about:blank' })
  })
})
