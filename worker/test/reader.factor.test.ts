import { describe, it, expect } from 'vitest'
import { factorFor } from '../src/services/reader'

describe('factorFor', () => {
  it('returns 8 for news domains', () => {
    expect(factorFor('www.nytimes.com')).toBe(8)
    expect(factorFor('bbc.co.uk')).toBe(8)
    expect(factorFor('edition.cnn.com')).toBe(8)
    expect(factorFor('www.guardian.co.uk')).toBe(8)
    expect(factorFor('www.washingtonpost.com')).toBe(8)
    expect(factorFor('www.reuters.com')).toBe(8)
  })

  it('returns 5 for blog platforms', () => {
    expect(factorFor('medium.com')).toBe(5)
    expect(factorFor('someone.substack.com')).toBe(5)
    expect(factorFor('blog.wordpress.com')).toBe(5)
    expect(factorFor('me.blogspot.com')).toBe(5)
  })

  it('returns 2 for app-like domains', () => {
    expect(factorFor('app.slack.com')).toBe(2)
    expect(factorFor('github.com')).toBe(2)
    expect(factorFor('some.app')).toBe(2)
  })

  it('returns 4 for everything else', () => {
    expect(factorFor('example.com')).toBe(4)
    expect(factorFor('random.io')).toBe(4)
    expect(factorFor('news.unknown.ng')).toBe(4)
  })

  it('is case-insensitive on hostname', () => {
    expect(factorFor('NYTIMES.com')).toBe(8)
    expect(factorFor('Medium.com')).toBe(5)
  })
})
