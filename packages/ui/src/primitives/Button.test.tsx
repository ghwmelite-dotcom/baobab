import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Open tab</Button>)
    expect(screen.getByRole('button', { name: 'Open tab' })).toBeInTheDocument()
  })
  it('meets the 44px hit-target rule via min-height', () => {
    render(<Button>x</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveStyle({ minHeight: '44px' })
  })
  it('exposes aria-busy when loading', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true')
  })
  it('disables interaction when loading', () => {
    render(<Button loading>Save</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
