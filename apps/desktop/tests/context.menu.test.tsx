import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextMenu, type ContextMenuItem } from '~/chrome/ContextMenu'

function build(): { items: ContextMenuItem[]; onClose: ReturnType<typeof vi.fn>; spies: { dup: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } } {
  const dup = vi.fn()
  const close = vi.fn()
  const items: ContextMenuItem[] = [
    { label: 'Duplicate', onSelect: dup },
    { kind: 'separator' },
    { label: 'Close', shortcut: 'Ctrl+W', danger: true, onSelect: close },
    { label: 'Disabled', disabled: true, onSelect: () => {} },
  ]
  return { items, onClose: vi.fn(), spies: { dup, close } }
}

describe('ContextMenu', () => {
  it('renders all visible items with labels + shortcut hints', () => {
    const { items, onClose } = build()
    render(<ContextMenu items={items} x={10} y={10} onClose={onClose} />)
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Close')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+W')).toBeInTheDocument()
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.getByRole('menu', { name: 'Context menu' })).toBeInTheDocument()
  })

  it('clicking an enabled item invokes onSelect and closes the menu', async () => {
    const { items, onClose, spies } = build()
    render(<ContextMenu items={items} x={10} y={10} onClose={onClose} />)
    fireEvent.click(screen.getByText('Duplicate'))
    expect(onClose).toHaveBeenCalled()
    // onSelect is fired via queueMicrotask — flush.
    await Promise.resolve()
    expect(spies.dup).toHaveBeenCalledOnce()
  })

  it('clicking a disabled item does not fire onSelect', async () => {
    const onSelect = vi.fn()
    const items: ContextMenuItem[] = [{ label: 'X', disabled: true, onSelect }]
    const onClose = vi.fn()
    render(<ContextMenu items={items} x={10} y={10} onClose={onClose} />)
    fireEvent.click(screen.getByText('X'))
    await Promise.resolve()
    expect(onSelect).not.toHaveBeenCalled()
    // Disabled items don't trigger a close either.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Escape closes the menu', () => {
    const { items, onClose } = build()
    render(<ContextMenu items={items} x={10} y={10} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('outside pointerdown closes the menu', () => {
    const { items, onClose } = build()
    render(
      <div>
        <button data-testid="outside">outside</button>
        <ContextMenu items={items} x={10} y={10} onClose={onClose} />
      </div>,
    )
    fireEvent.pointerDown(screen.getByTestId('outside'))
    expect(onClose).toHaveBeenCalled()
  })
})
