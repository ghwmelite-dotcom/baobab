import { describe, it, expect } from 'vitest'
import { READER_BASE_URL, READER_URL_RE, buildReaderUrl, parseReaderUrl } from '~/reader/intercept'

describe('reader URL helpers', () => {
  it('READER_BASE_URL ends with /reader.html', () => {
    expect(READER_BASE_URL.endsWith('/reader.html')).toBe(true)
  })

  it('buildReaderUrl encodes the original URL into the query string', () => {
    const u = buildReaderUrl('https://example.com/article?a=1&b=2')
    expect(u).toContain('reader.html?url=')
    expect(u).toContain(encodeURIComponent('https://example.com/article?a=1&b=2'))
  })

  it('parseReaderUrl returns the original URL', () => {
    const orig = 'https://example.com/article?a=1&b=2'
    const r = parseReaderUrl(buildReaderUrl(orig))
    expect(r).toBe(orig)
  })

  it('parseReaderUrl returns null for non-reader URLs', () => {
    expect(parseReaderUrl('https://example.com/article')).toBe(null)
    expect(parseReaderUrl('about:blank')).toBe(null)
    expect(parseReaderUrl('tauri://localhost/picker.html')).toBe(null)
  })

  it('READER_URL_RE matches both dev and prod', () => {
    expect('http://localhost:1420/reader.html?url=foo').toMatch(READER_URL_RE)
    expect('tauri://localhost/reader.html?url=foo').toMatch(READER_URL_RE)
    expect('https://example.com/reader.html').not.toMatch(READER_URL_RE)
  })
})
