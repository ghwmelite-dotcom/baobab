import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileTile } from '~/picker/ProfileTile'

const profile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
  pinRequired: false,
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

const lockedProfile = { ...profile, pinRequired: true }

describe('ProfileTile – PIN badge and menu', () => {
  it('shows the lock badge when pinRequired is true', () => {
    render(<ProfileTile profile={lockedProfile} onSelect={() => undefined} />)
    expect(screen.getByLabelText('Akua is locked')).toBeInTheDocument()
  })

  it('does not show lock badge when pinRequired is false', () => {
    render(<ProfileTile profile={profile} onSelect={() => undefined} />)
    expect(screen.queryByLabelText('Akua is locked')).toBeNull()
  })

  it('locked menu offers Change PIN and Remove PIN, not Set PIN', () => {
    render(
      <ProfileTile
        profile={lockedProfile}
        onSelect={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
        onChangePin={() => undefined}
        onRemovePin={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /more options for akua/i }))
    expect(screen.getByRole('menuitem', { name: /change pin/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /remove pin/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /set pin/i })).toBeNull()
  })

  it('unlocked menu offers Set PIN, not Change/Remove', () => {
    render(
      <ProfileTile
        profile={profile}
        onSelect={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
        onSetPin={() => undefined}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /more options for akua/i }))
    expect(screen.getByRole('menuitem', { name: /set pin/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /change pin/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /remove pin/i })).toBeNull()
  })
})
