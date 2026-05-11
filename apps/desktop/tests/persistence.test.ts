import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGet, mockSet, mockSave, mockDelete, mockLoad } = vi.hoisted(() => {
  const mockGet = vi.fn()
  const mockSet = vi.fn()
  const mockSave = vi.fn()
  const mockDelete = vi.fn()
  const mockLoad = vi.fn(async () => ({ get: mockGet, set: mockSet, save: mockSave, delete: mockDelete }))
  return { mockGet, mockSet, mockSave, mockDelete, mockLoad }
})

vi.mock('@tauri-apps/plugin-store', () => ({
  Store: { load: mockLoad },
  load: mockLoad,
}))

import { persistence } from '~/state/persistence'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('persistence', () => {
  it('stores and retrieves a value via the underlying store', async () => {
    mockGet.mockResolvedValueOnce('abc')
    const v = await persistence.get<string>('auth.accessToken')
    expect(v).toBe('abc')
    expect(mockGet).toHaveBeenCalledWith('auth.accessToken')
  })

  it('writes through save() after set', async () => {
    await persistence.set('auth.refreshToken', 'xyz')
    expect(mockSet).toHaveBeenCalledWith('auth.refreshToken', 'xyz')
    expect(mockSave).toHaveBeenCalled()
  })

  it('delete removes the key and saves', async () => {
    await persistence.delete('auth.accessToken')
    expect(mockDelete).toHaveBeenCalledWith('auth.accessToken')
    expect(mockSave).toHaveBeenCalled()
  })
})
