import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@tauri-apps/api/core')

vi.mock('~/auth/auth.store', () => {
  const setProfileId = vi.fn()
  const useAuthStore = Object.assign(
    () => undefined,
    { getState: () => ({ setProfileId }), setState: () => undefined },
  )
  return { useAuthStore }
})

vi.mock('~/state/tabs.store', () => {
  const setProfileId = vi.fn()
  const useTabsStore = Object.assign(
    () => undefined,
    { getState: () => ({ setProfileId }), setState: () => undefined },
  )
  return { useTabsStore }
})

import { ProfileProvider, useProfile } from '~/profiles/ProfileContext'
import * as tauriCore from '@tauri-apps/api/core'

const invokeMock = vi.mocked(tauriCore.invoke)

function Probe() {
  const p = useProfile()
  return <div data-testid="probe">{p ? `${p.id}|${p.name}` : 'no-profile'}</div>
}

beforeEach(() => { invokeMock.mockReset() })

describe('ProfileProvider', () => {
  it('renders the profile resolved from current_profile_id', async () => {
    const sample = {
      id: 'abc', name: 'Akua', fruitColor: 'mango', avatarLetter: 'A',
      createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'userdata',
    }
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'current_profile_id') return Promise.resolve('abc')
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sample])
      return Promise.resolve()
    })

    render(<ProfileProvider><Probe /></ProfileProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('abc|Akua'))
  })

  it('falls back to guest sentinel when window is guest', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'current_profile_id') return Promise.resolve('guest')
      if (cmd === 'cmd_list_profiles') return Promise.resolve([])
      return Promise.resolve()
    })

    render(<ProfileProvider><Probe /></ProfileProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('guest|Guest'))
  })
})
