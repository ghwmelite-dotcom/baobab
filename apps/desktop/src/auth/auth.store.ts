import { create } from 'zustand'
import type { MeResponse } from '@baobab/cloud-client'
import { client, authClient } from './api'
import { persistence, profileScoped } from '~/state/persistence'

type Status = 'idle' | 'authing' | 'authed' | 'error'
type Scoped = ReturnType<typeof profileScoped>

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: MeResponse | null
  status: Status
  error: string | null
  signInOverlayOpen: boolean
  setProfileId: (profileId: string) => void
  hydrate: () => Promise<void>
  signupEmail: (email: string, password: string) => Promise<void>
  loginEmail: (email: string, password: string) => Promise<void>
  signupPhone: (phone: string, password: string) => Promise<void>
  loginPhone: (phone: string, password: string) => Promise<void>
  otpSend: (phone: string) => Promise<void>
  otpVerify: (phone: string, code: string) => Promise<void>
  logout: () => Promise<void>
  openSignIn: () => void
  closeSignIn: () => void
}

let currentScope: Scoped | null = null

function scope(): Scoped {
  if (!currentScope) throw new Error('auth.store: setProfileId() must be called before accessing profile-scoped storage')
  return currentScope
}

async function persistTokens(access: string, refresh: string): Promise<void> {
  await scope().set('auth.accessToken', access)
  await scope().set('auth.refreshToken', refresh)
}

async function clearTokens(): Promise<void> {
  await scope().delete('auth.accessToken')
  await scope().delete('auth.refreshToken')
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  status: 'idle',
  error: null,
  signInOverlayOpen: false,

  setProfileId: (profileId) => {
    currentScope = profileScoped(profileId)
  },

  openSignIn: () => set({ signInOverlayOpen: true }),
  closeSignIn: () => set({ signInOverlayOpen: false }),

  hydrate: async () => {
    const a = await scope().get<string>('auth.accessToken')
    const r = await scope().get<string>('auth.refreshToken')
    if (a && r) {
      client.setAccessToken(a)
      try {
        const user = await authClient.me()
        set({ accessToken: a, refreshToken: r, user, status: 'authed' })
      } catch {
        await clearTokens()
        set({ accessToken: null, refreshToken: null, user: null, status: 'idle' })
      }
    } else {
      set({ status: 'idle' })
    }
  },

  signupEmail: async (email, password) => {
    set({ status: 'authing', error: null })
    try {
      const { access, refresh } = await authClient.signupEmail(email, password)
      client.setAccessToken(access)
      await persistTokens(access, refresh)
      const user = await authClient.me()
      set({ accessToken: access, refreshToken: refresh, user, status: 'authed', signInOverlayOpen: false })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'signup failed' })
      throw e
    }
  },

  loginEmail: async (email, password) => {
    set({ status: 'authing', error: null })
    try {
      const { access, refresh } = await authClient.loginEmail(email, password)
      client.setAccessToken(access)
      await persistTokens(access, refresh)
      const user = await authClient.me()
      set({ accessToken: access, refreshToken: refresh, user, status: 'authed', signInOverlayOpen: false })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'login failed' })
      throw e
    }
  },

  signupPhone: async (phone, password) => {
    set({ status: 'authing', error: null })
    try {
      const { access, refresh } = await authClient.signupPhone(phone, password)
      client.setAccessToken(access)
      await persistTokens(access, refresh)
      const user = await authClient.me()
      set({ accessToken: access, refreshToken: refresh, user, status: 'authed', signInOverlayOpen: false })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'signup failed' })
      throw e
    }
  },

  loginPhone: async (phone, password) => {
    set({ status: 'authing', error: null })
    try {
      const { access, refresh } = await authClient.loginPhone(phone, password)
      client.setAccessToken(access)
      await persistTokens(access, refresh)
      const user = await authClient.me()
      set({ accessToken: access, refreshToken: refresh, user, status: 'authed', signInOverlayOpen: false })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'login failed' })
      throw e
    }
  },

  otpSend: async (phone) => {
    await authClient.otpSend(phone)
  },

  otpVerify: async (phone, code) => {
    set({ status: 'authing', error: null })
    try {
      const { access, refresh } = await authClient.otpVerify(phone, code)
      client.setAccessToken(access)
      await persistTokens(access, refresh)
      const user = await authClient.me()
      set({ accessToken: access, refreshToken: refresh, user, status: 'authed', signInOverlayOpen: false })
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'verification failed' })
      throw e
    }
  },

  logout: async () => {
    try {
      await authClient.logout()
    } catch {
      /* tolerate */
    }
    client.setAccessToken(null)
    await clearTokens()
    set({ accessToken: null, refreshToken: null, user: null, status: 'idle' })
  },
}))
