import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('@tauri-apps/api/core')

const authSetProfileId = vi.fn()
vi.mock('~/auth/auth.store', () => {
  const useAuthStore = Object.assign(
    () => undefined,
    { getState: () => ({ setProfileId: authSetProfileId }), setState: () => undefined },
  )
  return { useAuthStore }
})

const tabsSetProfileId = vi.fn()
vi.mock('~/state/tabs.store', () => {
  const useTabsStore = Object.assign(
    () => undefined,
    { getState: () => ({ setProfileId: tabsSetProfileId }), setState: () => undefined },
  )
  return { useTabsStore }
})

// Stub out the migration helper so this test doesn't touch the real Tauri store.
vi.mock('~/profiles/migrateLegacyKeys', () => ({
  migrateLegacyAuthKeys: vi.fn(async () => undefined),
}))

import { ProfileProvider, useProfile } from '~/profiles/ProfileContext'
import * as tauriCore from '@tauri-apps/api/core'

const invokeMock = vi.mocked(tauriCore.invoke)

function Probe() {
  const p = useProfile()
  return <div data-testid="probe">{p ? `${p.id}|${p.name}` : 'no-profile'}</div>
}

beforeEach(() => {
  invokeMock.mockReset()
  authSetProfileId.mockReset()
  tabsSetProfileId.mockReset()
})

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
    expect(authSetProfileId).toHaveBeenCalledWith('abc')
    expect(tabsSetProfileId).toHaveBeenCalledWith('abc')
  })

  it('falls back to guest sentinel when window is guest', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'current_profile_id') return Promise.resolve('guest')
      if (cmd === 'cmd_list_profiles') return Promise.resolve([])
      return Promise.resolve()
    })

    render(<ProfileProvider><Probe /></ProfileProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('guest|Guest'))
    expect(authSetProfileId).toHaveBeenCalledWith('guest')
    expect(tabsSetProfileId).toHaveBeenCalledWith('guest')
  })
})
