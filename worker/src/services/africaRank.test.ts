import { describe, it, expect } from 'vitest'
import { rerank, type AnnotatedResult } from './africaRank'

const r = (title: string, url: string, source: string, snippet = 'x') => ({
  title, url, snippet, source,
})

describe('africaRank.rerank', () => {
  it('bubbles African sources to the top', () => {
    const input = [
      r('A', 'https://cnn.com/x', 'cnn.com'),
      r('B', 'https://vanguardngr.com/y', 'vanguardngr.com'),
      r('C', 'https://bbc.com/z', 'bbc.com'),
    ]
    const out = rerank(input)
    expect(out[0].source).toBe('vanguardngr.com')
    expect(out[0].isAfrican).toBe(true)
    expect(out[0].country).toBe('NG')
    expect(out[1].source).toBe('cnn.com')
    expect(out[1].isAfrican).toBe(false)
  })

  it('preserves PSE order within each bucket (stable sort)', () => {
    const input = [
      r('1', 'https://a.com/x', 'a.com'),
      r('2', 'https://mg.co.za/y', 'mg.co.za'),
      r('3', 'https://b.com/z', 'b.com'),
      r('4', 'https://techcabal.com/q', 'techcabal.com'),
    ]
    const out = rerank(input)
    expect(out.map((x) => x.source)).toEqual([
      'mg.co.za',         // African, originally #2
      'techcabal.com',    // African, originally #4
      'a.com',            // non-African, originally #1
      'b.com',            // non-African, originally #3
    ])
  })

  it('handles empty input', () => {
    expect(rerank([])).toEqual([])
  })

  it('marks all non-African results as isAfrican=false with null country', () => {
    const out = rerank([r('x', 'https://cnn.com/a', 'cnn.com')])
    expect(out[0].isAfrican).toBe(false)
    expect(out[0].country).toBeNull()
  })
})
