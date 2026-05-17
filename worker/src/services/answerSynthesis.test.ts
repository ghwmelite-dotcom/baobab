import { describe, it, expect, vi } from 'vitest'
import { synthesize, buildPrompt } from './answerSynthesis'
import type { AnnotatedResult } from './africaRank'

const sample: AnnotatedResult[] = [
  { title: 'Mansa Musa biography', url: 'https://mansamusa.ml/bio', snippet: 'Mali emperor.',
    source: 'mansamusa.ml', isAfrican: true, country: 'ML' },
  { title: 'Mali Empire', url: 'https://history.za/west-africa', snippet: 'Trade routes.',
    source: 'history.za', isAfrican: true, country: 'ZA' },
  { title: 'Wikipedia Musa I', url: 'https://en.wikipedia.org/wiki/Musa_I_of_Mali',
    snippet: 'Encyclopaedia entry.', source: 'en.wikipedia.org', isAfrican: false, country: null },
]

describe('answerSynthesis.buildPrompt', () => {
  it('includes Africa-first instruction', () => {
    const p = buildPrompt('history of mansa musa', sample, [])
    expect(p).toMatch(/prefer African/i)
    expect(p).toMatch(/cite/i)
  })

  it('includes the result sources by index', () => {
    const p = buildPrompt('q', sample, [])
    expect(p).toContain('mansamusa.ml')
    expect(p).toContain('en.wikipedia.org')
  })

  it('appends context chain when provided', () => {
    const p = buildPrompt(
      'follow-up',
      sample,
      [{ query: 'prev', answer: 'prev-ans' }],
    )
    expect(p).toContain('prev')
    expect(p).toContain('prev-ans')
  })

  it('appends source URL when provided (search-while-reading)', () => {
    const p = buildPrompt('q', sample, [], { url: 'https://x.com/y', title: 'The Y page' })
    expect(p).toMatch(/reading.*The Y page/i)
  })
})

describe('answerSynthesis.synthesize', () => {
  const makeAi = (raw: string) => ({
    run: vi.fn(async () => ({ response: raw })),
  })

  it('returns parsed answer + citations on valid JSON output', async () => {
    const ai = makeAi(JSON.stringify({
      answer: 'Mansa Musa ruled Mali...',
      citations: [
        { name: 'Souleymane Sidibé', country: 'ML', type: 'scholar' },
        { name: 'Mansamusa.ml', country: 'ML', type: 'publication', url: 'https://mansamusa.ml/bio' },
      ],
    }))
    const result = await synthesize(ai as never, 'q', sample, [])
    expect(result.answer).toContain('Mansa Musa')
    expect(result.citations).toHaveLength(2)
    expect(result.citations[0].name).toBe('Souleymane Sidibé')
  })

  it('drops citations whose url is not in the result set', async () => {
    const ai = makeAi(JSON.stringify({
      answer: 'ans',
      citations: [
        { name: 'Real', url: 'https://mansamusa.ml/bio', country: 'ML', type: 'publication' },
        { name: 'Fake', url: 'https://invented.com/x', country: 'XX', type: 'publication' },
      ],
    }))
    const result = await synthesize(ai as never, 'q', sample, [])
    expect(result.citations).toHaveLength(1)
    expect(result.citations[0].name).toBe('Real')
  })

  it('returns empty citations when parse fails', async () => {
    const ai = makeAi('not json at all')
    const result = await synthesize(ai as never, 'q', sample, [])
    expect(result.answer).toBe('')
    expect(result.citations).toEqual([])
  })

  it('caps citations at 6', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      name: `Person ${i}`, country: 'NG', type: 'scholar' as const,
    }))
    const ai = makeAi(JSON.stringify({ answer: 'x', citations: many }))
    const result = await synthesize(ai as never, 'q', sample, [])
    expect(result.citations.length).toBeLessThanOrEqual(6)
  })
})
