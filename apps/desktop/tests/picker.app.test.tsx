import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { PickerApp } from '~/picker/PickerApp'
import { usePickerData } from '~/picker/usePickerData'

const invokeMock = invoke as ReturnType<typeof vi.fn>

const sample = (id: string, name: string) => ({
  id, name, fruitColor: 'mango' as const, avatarLetter: name[0],
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
})

beforeEach(() => {
  invokeMock.mockReset()
  usePickerData.setState({ profiles: [], showOnStartup: false, loading: false, error: null })
})

describe('PickerApp', () => {
  it('shows tiles for each profile on mount', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample('p1', 'Akua'), sample('p2', 'Kofi')])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: null })
      return Promise.resolve()
    })
    render(<PickerApp />)
    await waitFor(() => {
      expect(screen.getByText('Akua')).toBeInTheDocument()
      expect(screen.getByText('Kofi')).toBeInTheDocument()
    })
  })

  it('clicking a tile invokes open_profile_window', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample('p1', 'Akua')])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: null })
      return Promise.resolve()
    })
    render(<PickerApp />)
    await waitFor(() => screen.getByText('Akua'))
    fireEvent.click(screen.getByRole('button', { name: /open akua/i }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1' })
    })
  })

  it('toggling Show on startup persists to Rust', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample('p1', 'Akua')])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: false, lastUsedProfileId: null })
      return Promise.resolve()
    })
    render(<PickerApp />)
    await waitFor(() => screen.getByText('Akua'))
    fireEvent.click(screen.getByRole('checkbox', { name: /show on startup/i }))
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('cmd_set_show_on_startup', { value: true })
    })
  })
})
