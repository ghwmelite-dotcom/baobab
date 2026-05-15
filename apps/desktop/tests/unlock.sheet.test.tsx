import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { UnlockSheet } from '~/picker/UnlockSheet'

const invokeMock = invoke as ReturnType<typeof vi.fn>

const profile = {
  id: 'p1', name: 'Akua', fruitColor: 'mango' as const, avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u', pinRequired: true,
}

beforeEach(() => { invokeMock.mockReset() })

function type4(digits: string) {
  const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
  for (let i = 0; i < 4; i++) {
    fireEvent.change(boxes[i]!, { target: { value: digits[i] } })
  }
}

describe('UnlockSheet', () => {
  it('renders the profile name', () => {
    render(<UnlockSheet open profile={profile} onClose={() => undefined} />)
    expect(screen.getByText(/Akua/)).toBeInTheDocument()
  })

  it('correct PIN calls open_profile_window and closes', async () => {
    invokeMock.mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<UnlockSheet open profile={profile} onClose={onClose} />)
    type4('1234')
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1', pin: '1234' })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('wrong PIN shows error and re-enables input', async () => {
    invokeMock.mockRejectedValueOnce('wrong_pin')
    render(<UnlockSheet open profile={profile} onClose={() => undefined} />)
    type4('0000')
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/wrong/i)
    })
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(boxes[0]!.disabled).toBe(false)
  })

  it('locked response shows countdown and disables input', async () => {
    invokeMock.mockRejectedValueOnce('locked:30')
    render(<UnlockSheet open profile={profile} onClose={() => undefined} />)
    type4('0000')
    await waitFor(() => {
      expect(screen.getByText(/Try again in/i)).toBeInTheDocument()
    })
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[]
    expect(boxes[0]!.disabled).toBe(true)
  })
})
