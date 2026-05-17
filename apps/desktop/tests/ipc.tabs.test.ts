import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ label: 'profile-test' }),
}))

import { invoke } from '@tauri-apps/api/core'
import { ipcTabReload } from '~/ipc/tabs'

const invokeMock = invoke as ReturnType<typeof vi.fn>

beforeEach(() => {
  invokeMock.mockReset()
})

describe('ipcTabReload', () => {
  it('invokes tab_reload with the given tabId', async () => {
    invokeMock.mockResolvedValue(undefined)
    await ipcTabReload('abc')
    expect(invokeMock).toHaveBeenCalledWith('tab_reload', { tabId: 'abc' })
  })
})
