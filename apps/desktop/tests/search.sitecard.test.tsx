import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SiteCard } from '~/search/SiteCard'

describe('SiteCard', () => {
  it('renders name, URL, description, Visit button', () => {
    render(<SiteCard card={{
      name: 'Paystack', url: 'https://paystack.com', country: 'NG',
      description: 'Modern payments for Africa', sitelinks: [],
    }} />)
    expect(screen.getByText('Paystack')).toBeInTheDocument()
    expect(screen.getByText(/Modern payments/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Visit/ })).toHaveAttribute('href', 'https://paystack.com')
  })

  it('renders flag emoji for known country code', () => {
    render(<SiteCard card={{
      name: 'X', url: 'https://x.com', country: 'NG',
      description: 'd', sitelinks: [],
    }} />)
    expect(screen.getByText(/🇳🇬/)).toBeInTheDocument()
  })

  it('renders up to 6 sitelinks in a grid', () => {
    render(<SiteCard card={{
      name: 'X', url: 'https://x.com', description: 'd',
      sitelinks: Array.from({ length: 8 }, (_, i) => ({
        title: `Link ${i}`, path: `/p${i}`, url: `https://x.com/p${i}`,
      })),
    }} />)
    expect(screen.getAllByRole('link', { name: /^Link/ })).toHaveLength(6)
  })

  it('omits African context strip when country is not set', () => {
    render(<SiteCard card={{
      name: 'X', url: 'https://x.com', description: 'd', sitelinks: [],
    }} />)
    expect(screen.queryByText(/African-founded/i)).not.toBeInTheDocument()
  })

  it('shows African context strip when country is set', () => {
    render(<SiteCard card={{
      name: 'X', url: 'https://x.com', country: 'NG',
      description: 'd', sitelinks: [],
    }} />)
    expect(screen.getByText(/African-founded/i)).toBeInTheDocument()
  })
})
