import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileTile } from '~/picker/ProfileTile'

const profile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
}

describe('ProfileTile', () => {
  it('renders name + avatar letter', () => {
    render(<ProfileTile profile={profile} onSelect={() => undefined} />)
    expect(screen.getByText('Akua')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<ProfileTile profile={profile} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /open akua/i }))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('exposes a per-tile menu with Rename + Delete', () => {
    const onRename = vi.fn(); const onDelete = vi.fn()
    render(<ProfileTile profile={profile} onSelect={() => undefined} onRename={onRename} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /more options for akua/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
    expect(onRename).toHaveBeenCalledWith('p1')
  })
})
