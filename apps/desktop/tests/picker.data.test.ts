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
  pinRequired: false,
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
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1', pin: null })
  })
})

const lockedProfile = (id: string, name: string) => ({
  id, name, fruitColor: 'mango' as const, avatarLetter: name[0] ?? '',
  createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
  pinRequired: true,
})
const unlockedProfile = (id: string, name: string) => ({
  ...lockedProfile(id, name),
  pinRequired: false,
})

describe('usePickerData PIN routing', () => {
  it('select on unlocked profile calls open_profile_window directly', async () => {
    invokeMock.mockResolvedValue(undefined)
    usePickerData.setState({ profiles: [unlockedProfile('p1', 'Akua')], showOnStartup: false, loading: false, error: null, unlockTarget: null })
    await usePickerData.getState().select('p1')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'p1', pin: null })
    expect(usePickerData.getState().unlockTarget).toBeNull()
  })

  it('select on locked profile does NOT call open_profile_window; sets unlockTarget', async () => {
    invokeMock.mockResolvedValue(undefined)
    usePickerData.setState({ profiles: [lockedProfile('p1', 'Akua')], showOnStartup: false, loading: false, error: null, unlockTarget: null })
    await usePickerData.getState().select('p1')
    expect(invokeMock).not.toHaveBeenCalled()
    expect(usePickerData.getState().unlockTarget).toBe('p1')
  })

  it('clearUnlockTarget resets', () => {
    usePickerData.setState({ unlockTarget: 'p1' } as any)
    usePickerData.getState().clearUnlockTarget()
    expect(usePickerData.getState().unlockTarget).toBeNull()
  })

  it('setPin calls cmd_set_profile_pin and rehydrates', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_set_profile_pin') return Promise.resolve()
      if (cmd === 'cmd_list_profiles') return Promise.resolve([])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: false, lastUsedProfileId: null })
      return Promise.resolve()
    })
    await usePickerData.getState().setPin('p1', '1234')
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_profile_pin', { id: 'p1', newPin: '1234', currentPin: null })
  })

  it('removePin calls cmd_remove_profile_pin and rehydrates', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'cmd_remove_profile_pin') return Promise.resolve()
      if (cmd === 'cmd_list_profiles') return Promise.resolve([])
      if (cmd === 'cmd_get_picker_prefs') return Promise.resolve({ showOnStartup: false, lastUsedProfileId: null })
      return Promise.resolve()
    })
    await usePickerData.getState().removePin('p1', '1234')
    expect(invokeMock).toHaveBeenCalledWith('cmd_remove_profile_pin', { id: 'p1', currentPin: '1234' })
  })
})
