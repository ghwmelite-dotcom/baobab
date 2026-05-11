import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('~/state/persistence', () => ({
  persistence: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('~/auth/api', () => {
  return {
    authClient: {
      signupEmail: vi.fn(async () => ({ access: 'a', refresh: 'r' })),
      loginEmail: vi.fn(async () => ({ access: 'a', refresh: 'r' })),
      refresh: vi.fn(async () => ({ access: 'new-a' })),
      me: vi.fn(async () => ({ id: 'u', email: 'a@b.com', phone: null, privacy_mode: 0, low_bandwidth_mode: 0, default_model: 'x' })),
      otpSend: vi.fn(async () => ({ ok: true })),
      otpVerify: vi.fn(async () => ({ access: 'a', refresh: 'r' })),
      logout: vi.fn(async () => ({ ok: true })),
    },
    client: { setAccessToken: vi.fn() },
  }
})

import { useAuthStore } from '~/auth/auth.store'
import { persistence } from '~/state/persistence'

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, status: 'idle', error: null })
})

describe('auth store', () => {
  it('signupEmail persists tokens and loads me()', async () => {
    await useAuthStore.getState().signupEmail('a@b.com', 'long-password-123')
    const s = useAuthStore.getState()
    expect(s.accessToken).toBe('a')
    expect(s.refreshToken).toBe('r')
    expect(s.user?.email).toBe('a@b.com')
    expect(persistence.set).toHaveBeenCalledWith('auth.accessToken', 'a')
    expect(persistence.set).toHaveBeenCalledWith('auth.refreshToken', 'r')
    expect(s.status).toBe('authed')
  })

  it('logout clears tokens + user + storage', async () => {
    useAuthStore.setState({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u', email: 'x', phone: null, privacy_mode: 0, low_bandwidth_mode: 0, default_model: 'm' },
      status: 'authed',
    })
    await useAuthStore.getState().logout()
    const s = useAuthStore.getState()
    expect(s.accessToken).toBeNull()
    expect(s.user).toBeNull()
    expect(persistence.delete).toHaveBeenCalledWith('auth.accessToken')
    expect(persistence.delete).toHaveBeenCalledWith('auth.refreshToken')
  })
})
