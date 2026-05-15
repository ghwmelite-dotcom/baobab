import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { profileApi } from '~/profiles/profile.api'

const invokeMock = invoke as ReturnType<typeof vi.fn>

beforeEach(() => { invokeMock.mockReset() })

describe('profileApi', () => {
  it('listProfiles calls cmd_list_profiles', async () => {
    invokeMock.mockResolvedValue([])
    await profileApi.list()
    expect(invokeMock).toHaveBeenCalledWith('cmd_list_profiles')
  })

  it('create sends name + color', async () => {
    invokeMock.mockResolvedValue({
      id: '1', name: 'A', fruitColor: 'mango', avatarLetter: 'A',
      createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
      pinRequired: false,
    })
    await profileApi.create('A', 'mango')
    expect(invokeMock).toHaveBeenCalledWith('cmd_create_profile', { name: 'A', fruitColor: 'mango', pin: null })
  })

  it('rename sends id + name', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.rename('id-1', 'New')
    expect(invokeMock).toHaveBeenCalledWith('cmd_rename_profile', { id: 'id-1', name: 'New' })
  })

  it('delete sends id', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.delete('id-1')
    expect(invokeMock).toHaveBeenCalledWith('cmd_delete_profile', { id: 'id-1' })
  })

  it('setShowOnStartup sends bool', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.setShowOnStartup(true)
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_show_on_startup', { value: true })
  })

  it('openProfileWindow sends profileId', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.openProfileWindow('id-1')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'id-1', pin: null })
  })

  it('openGuestWindow takes no args', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.openGuestWindow()
    expect(invokeMock).toHaveBeenCalledWith('open_guest_window')
  })

  it('create with PIN forwards the pin arg', async () => {
    invokeMock.mockResolvedValue({
      id: '1', name: 'A', fruitColor: 'mango', avatarLetter: 'A',
      createdAt: 'x', lastUsedAt: 'x', cloudLink: null, userDataDirName: 'u',
      pinRequired: true,
    })
    await profileApi.create('A', 'mango', '1234')
    expect(invokeMock).toHaveBeenCalledWith('cmd_create_profile', { name: 'A', fruitColor: 'mango', pin: '1234' })
  })

  it('setPin sends id + newPin + currentPin', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.setPin('id-1', '1234', '0000')
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_profile_pin', { id: 'id-1', newPin: '1234', currentPin: '0000' })
  })

  it('setPin without currentPin still sends the field as null', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.setPin('id-1', '1234')
    expect(invokeMock).toHaveBeenCalledWith('cmd_set_profile_pin', { id: 'id-1', newPin: '1234', currentPin: null })
  })

  it('removePin sends id + currentPin', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.removePin('id-1', '1234')
    expect(invokeMock).toHaveBeenCalledWith('cmd_remove_profile_pin', { id: 'id-1', currentPin: '1234' })
  })

  it('openProfileWindow forwards optional pin', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.openProfileWindow('id-1', '1234')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'id-1', pin: '1234' })
  })

  it('openProfileWindow without pin sends null', async () => {
    invokeMock.mockResolvedValue(undefined)
    await profileApi.openProfileWindow('id-1')
    expect(invokeMock).toHaveBeenCalledWith('open_profile_window', { profileId: 'id-1', pin: null })
  })
})
