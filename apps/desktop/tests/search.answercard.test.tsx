import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnswerCard } from '~/search/AnswerCard'

describe('AnswerCard', () => {
  it('renders English-only when bilingual is absent', () => {
    render(<AnswerCard answer={{ en: 'Mansa Musa ruled Mali.' }} citations={[]} />)
    expect(screen.getByText(/Mansa Musa ruled Mali/)).toBeInTheDocument()
    expect(screen.queryByText(/Yorùbá|Swahili|Hausa/)).not.toBeInTheDocument()
  })

  it('renders bilingual 2-column layout when bilingual present', () => {
    render(<AnswerCard
      answer={{ en: 'Mansa Musa', bilingual: { lang: 'yo', text: 'Mansa Musa ní Yorùbá' } }}
      citations={[]}
    />)
    expect(screen.getByText(/Mansa Musa$/)).toBeInTheDocument()
    expect(screen.getByText(/ní Yorùbá/)).toBeInTheDocument()
    expect(screen.getByText(/English/i)).toBeInTheDocument()
    // "Yorùbá" legitimately appears in both the lang tag and the body text
    expect(screen.getAllByText(/Yorùbá/i).length).toBeGreaterThanOrEqual(1)
  })

  it('renders citation pills when present', () => {
    render(<AnswerCard
      answer={{ en: 'A' }}
      citations={[
        { name: 'Souleymane Sidibé', country: 'ML', type: 'scholar' },
        { name: 'TechCabal', country: 'NG', type: 'publication' },
      ]}
    />)
    expect(screen.getByText(/Souleymane Sidibé/)).toBeInTheDocument()
    expect(screen.getByText(/TechCabal/)).toBeInTheDocument()
  })

  it('does not render voices row when citations empty', () => {
    render(<AnswerCard answer={{ en: 'A' }} citations={[]} />)
    expect(screen.queryByText(/African voices cited/i)).not.toBeInTheDocument()
  })
})
