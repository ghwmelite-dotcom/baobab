import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { CountdownModal } from '~/reader/CountdownModal'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('<CountdownModal>', () => {
  it('renders the URL and a countdown', () => {
    render(<CountdownModal url="https://example.com/x" onAccept={() => {}} onCancel={() => {}} />)
    expect(screen.getByText(/example\.com\/x/)).toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('counts down 3 → 2 → 1 → fires onAccept', async () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText(/2/)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText(/1/)).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1000) })
    // Allow queueMicrotask to flush and async state updates
    await act(async () => { await vi.runAllTimersAsync() })
    expect(onAccept).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('fires onCancel on Escape', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('fires onAccept on Enter (skip wait)', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it('"Open now" button fires onAccept immediately', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /open now/i }))
    expect(onAccept).toHaveBeenCalledOnce()
  })

  it('"Cancel" button fires onCancel', () => {
    const onAccept = vi.fn()
    const onCancel = vi.fn()
    render(<CountdownModal url="https://example.com/x" onAccept={onAccept} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('respects a custom seconds prop', async () => {
    const onAccept = vi.fn()
    render(<CountdownModal url="https://example.com/x" seconds={1} onAccept={onAccept} onCancel={() => {}} />)
    act(() => { vi.advanceTimersByTime(1000) })
    await act(async () => { await vi.runAllTimersAsync() })
    expect(onAccept).toHaveBeenCalledOnce()
  })
})
