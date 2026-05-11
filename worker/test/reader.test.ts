import { describe, expect, it } from 'vitest'
import { extractReadable } from '../src/services/reader'

describe('reader extract', () => {
  it('returns title and body text from a simple page', () => {
    const html = '<html><head><title>My Title</title></head><body><nav>nav</nav><main><article><p>Hello world.</p></article></main><footer>foot</footer></body></html>'
    const r = extractReadable(html)
    expect(r.title).toBe('My Title')
    expect(r.text).toContain('Hello world')
    expect(r.text).not.toContain('nav')
  })
})
