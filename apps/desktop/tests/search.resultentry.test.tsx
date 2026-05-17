import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultEntry } from '~/search/ResultEntry'

describe('ResultEntry v2', () => {
  it('renders title, URL, snippet', () => {
    render(<ResultEntry result={{
      title: 'TechCabal article', url: 'https://techcabal.com/x',
      source: 'techcabal.com', snippet: 'Inside the story',
      country: 'NG', isAfrican: true,
    }} />)
    expect(screen.getByText('TechCabal article')).toBeInTheDocument()
    expect(screen.getByText(/techcabal.com/)).toBeInTheDocument()
    expect(screen.getByText('Inside the story')).toBeInTheDocument()
  })

  it('renders flag + African badge when isAfrican', () => {
    render(<ResultEntry result={{
      title: 'T', url: 'https://x.ng', source: 'x.ng',
      snippet: 's', country: 'NG', isAfrican: true,
    }} />)
    expect(screen.getByText(/🇳🇬/)).toBeInTheDocument()
    expect(screen.getByText(/African Source/i)).toBeInTheDocument()
  })

  it('omits flag + badge when not African', () => {
    render(<ResultEntry result={{
      title: 'T', url: 'https://cnn.com', source: 'cnn.com',
      snippet: 's', country: null, isAfrican: false,
    }} />)
    expect(screen.queryByText(/African Source/i)).not.toBeInTheDocument()
  })
})
