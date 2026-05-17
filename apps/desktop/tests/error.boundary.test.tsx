import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '~/error/ErrorBoundary'

function Boom(): JSX.Element {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  const originalConsoleError = console.error
  let originalLocation: Location

  beforeEach(() => {
    // React 18 logs caught errors to console.error — silence to keep test output clean.
    console.error = vi.fn()
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: vi.fn() },
    })
  })

  afterEach(() => {
    console.error = originalConsoleError
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('renders the fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something snapped.')).toBeInTheDocument()
  })

  it('calls location.reload when Reload Baobab is clicked', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: /reload baobab/i }))
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it('dispatches baobab:react-error on window when a child throws', () => {
    const listener = vi.fn()
    window.addEventListener('baobab:react-error', listener as EventListener)
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(listener).toHaveBeenCalledTimes(1)
    const event = listener.mock.calls[0]?.[0] as CustomEvent<{ error: Error; componentStack: string | null }>
    expect(event.detail.error).toBeInstanceOf(Error)
    expect(event.detail.error.message).toBe('boom')
    window.removeEventListener('baobab:react-error', listener as EventListener)
  })
})
