import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { ReaderPill } from '~/reader/ReaderPill'

describe('<ReaderPill>', () => {
  it('renders the "📖 Reader" label', () => {
    render(<ReaderPill onLoadFullPage={() => {}} />)
    expect(screen.getByRole('button', { name: /reader/i })).toBeInTheDocument()
  })

  it('fires onLoadFullPage when clicked', () => {
    const onLoadFullPage = vi.fn()
    render(<ReaderPill onLoadFullPage={onLoadFullPage} />)
    fireEvent.click(screen.getByRole('button', { name: /reader/i }))
    expect(onLoadFullPage).toHaveBeenCalledOnce()
  })

  it('shows a tooltip', () => {
    render(<ReaderPill onLoadFullPage={() => {}} />)
    expect(screen.getByRole('button', { name: /reader/i })).toHaveAttribute('title')
  })
})
