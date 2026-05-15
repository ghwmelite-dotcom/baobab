import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))

import { invoke } from '@tauri-apps/api/core'
import { usePickerData } from '~/picker/usePickerData'

const invokeMock = invoke as ReturnType<typeof vi.fn>

beforeEach(() => {
  invokeMock.mockReset()
  usePickerData.setState({ profiles: [], showOnStartup: false, loading: false, error: null })
})

const sampleProfile = (overrides: Partial<{ id: string; name: string }> = {}) => ({
  id: overrides.id ?? 'p1',
  name: overrides.name ?? 'Akua',
  fruitColor: 'mango' as const,
  avatarLetter: 'A',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
})

describe('usePickerData', () => {
  it('hydrate loads profiles + prefs', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sampleProfile()])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: 'p1' })
      return Promise.resolve()
    })
    await usePickerData.getState().hydrate()
    const s = usePickerData.getState()
    expect(s.profiles).toHaveLength(1)
    expect(s.showOnStartup).toBe(true)
  })

  it('create adds a profile and hydrates', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_create_profile') return Promise.resolve(sampleProfile({ id: 'p2', name: 'Kofi' }))
      if (cmd === 'cmd_list_profiles') return Promise.resolve([sampleProfile(), sampleProfile({ id: 'p2', name: 'Kofi' })])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: true, lastUsedProfileId: null })
      return Promise.resolve()
    })
    await usePickerData.getState().create('Kofi')
    expect(usePickerData.getState().profiles).toHaveLength(2)
  })

  it('toggleShowOnStartup persists and updates store', async () => {
    invokeMock.mockResolvedValue(undefined)
    await usePickerData.getState().toggleShowOnStartup(true)
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_show_on_startup', { value: true })
    expect(usePickerData.getState().showOnStartup).toBe(true)
  })

  it('select calls open_profile_window', async () => {
    invokeMock.mockResolvedValue(undefined)
    await usePickerData.getState().select('p1')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1' })
  })
})
