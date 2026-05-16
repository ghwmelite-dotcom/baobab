import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchHeader } from '~/search/SearchHeader'

describe('SearchHeader', () => {
  it('pre-fills the input with the current query', () => {
    render(<SearchHeader query="baobab" onRefine={() => undefined} />)
    expect(screen.getByDisplayValue('baobab')).toBeInTheDocument()
  })

  it('Enter calls onRefine with the trimmed input value', () => {
    const onRefine = vi.fn()
    render(<SearchHeader query="initial" onRefine={onRefine} />)
    const input = screen.getByDisplayValue('initial') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  baobab tree  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRefine).toHaveBeenCalledWith('baobab tree')
  })
})
