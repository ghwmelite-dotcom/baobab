import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'profile-test' }),
}))

import { invoke } from '@tauri-apps/api/core'
import { adblockApi } from '~/adblock/adblock.api'

const invokeMock = invoke as ReturnType<typeof vi.fn>

beforeEach(() => {
  invokeMock.mockReset()
})

describe('adblockApi', () => {
  it('getState sends profileId', async () => {
    invokeMock.mockResolvedValue({
      enabled: true,
      lastUpdated: 'x',
      source: { kind: 'Bundled' },
    })
    await adblockApi.getState('p1')
    expect(invokeMock).toHaveBeenCalledWith('cmd_adblock_get_state', { profileId: 'p1' })
  })

  it('setEnabled sends profileId + enabled', async () => {
    invokeMock.mockResolvedValue(undefined)
    await adblockApi.setEnabled('p1', false)
    expect(invokeMock).toHaveBeenCalledWith('cmd_adblock_set_enabled', { profileId: 'p1', enabled: false })
  })

  it('refreshLists takes no args', async () => {
    invokeMock.mockResolvedValue({ enabled: true, lastUpdated: 'x', source: { kind: 'Bundled' } })
    await adblockApi.refreshLists()
    expect(invokeMock).toHaveBeenCalledWith('cmd_adblock_refresh_lists')
  })
})
