import { describe, expect, it } from 'vitest'
import { rerank, AFRICAN_SOURCES_SEED } from '../src/services/search-rank'

describe('search rerank', () => {
  it('lifts African sources above generic', () => {
    const ranked = rerank(
      [{ url: 'https://wikipedia.org/x' }, { url: 'https://premiumtimesng.com/article' }],
      AFRICAN_SOURCES_SEED
    )
    expect(ranked[0]!.url).toContain('premiumtimesng.com')
  })
})
