import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ThemeProvider } from './ThemeProvider'

describe('ThemeProvider', () => {
  it('applies dark tokens by default', () => {
    const { container } = render(
      <ThemeProvider>
        <span>x</span>
      </ThemeProvider>,
    )
    const root = container.firstChild as HTMLElement
    expect(root.dataset.baobabTheme).toBe('dark')
    expect(root.style.getPropertyValue('--canvas')).toBe('#15110d')
    expect(root.style.getPropertyValue('--accent')).toBe('#d97706')
  })
  it('applies light tokens when theme="light"', () => {
    const { container } = render(
      <ThemeProvider theme="light">
        <span>x</span>
      </ThemeProvider>,
    )
    const root = container.firstChild as HTMLElement
    expect(root.dataset.baobabTheme).toBe('light')
    expect(root.style.getPropertyValue('--canvas')).toBe('#faf6ee')
    expect(root.style.getPropertyValue('--accent')).toBe('#c2410c')
  })
})
