import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PinInput } from '~/picker/PinInput'

describe('PinInput', () => {
  it('renders 4 digit boxes', () => {
    render(<PinInput value="" onChange={() => undefined} />)
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
  })

  it('typing a digit advances focus and fires onChange', () => {
    const onChange = vi.fn()
    render(<PinInput value="" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    boxes[0].focus()
    fireEvent.change(boxes[0], { target: { value: '1' } })
    expect(onChange).toHaveBeenCalledWith('1')
    // Test rerender with the new value to drive focus advance.
  })

  it('rejects non-digit input', () => {
    const onChange = vi.fn()
    render(<PinInput value="" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    fireEvent.change(boxes[0], { target: { value: 'a' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('fires onComplete once value reaches 4 digits', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<PinInput value="123" onChange={() => undefined} onComplete={onComplete} />)
    expect(onComplete).not.toHaveBeenCalled()
    rerender(<PinInput value="1234" onChange={() => undefined} onComplete={onComplete} />)
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('does not fire onComplete twice for the same value', () => {
    const onComplete = vi.fn()
    const { rerender } = render(<PinInput value="1234" onChange={() => undefined} onComplete={onComplete} />)
    rerender(<PinInput value="1234" onChange={() => undefined} onComplete={onComplete} />)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('backspace on empty box moves focus back', () => {
    const onChange = vi.fn()
    render(<PinInput value="12" onChange={onChange} />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    boxes[2].focus()
    fireEvent.keyDown(boxes[2], { key: 'Backspace' })
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('disabled prop disables all boxes', () => {
    render(<PinInput value="" onChange={() => undefined} disabled />)
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(boxes.every((b) => b.disabled)).toBe(true)
  })

  it('shake prop sets data-shake attr (CSS hook)', () => {
    const { container } = render(<PinInput value="" onChange={() => undefined} shake />)
    expect(container.querySelector('[data-shake="true"]')).toBeTruthy()
  })
})
