import { create } from 'zustand'
import { authClient } from '~/auth/api'
import { useAuthStore } from '~/auth/auth.store'

interface SettingsState {
  open: boolean
  saving: boolean
  toggle: () => void
  close: () => void
  setPrivacyMode: (on: boolean) => Promise<void>
  setLowBandwidth: (on: boolean) => Promise<void>
  setDefaultModel: (model: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  open: false,
  saving: false,

  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),

  setPrivacyMode: async (on) => {
    set({ saving: true })
    try {
      await authClient.updateSettings({ privacy_mode: on ? 1 : 0 })
      useAuthStore.setState((s) => (s.user ? { user: { ...s.user, privacy_mode: on ? 1 : 0 } } : s))
    } finally {
      set({ saving: false })
    }
  },

  setLowBandwidth: async (on) => {
    set({ saving: true })
    try {
      await authClient.updateSettings({ low_bandwidth_mode: on ? 1 : 0 })
      useAuthStore.setState((s) => (s.user ? { user: { ...s.user, low_bandwidth_mode: on ? 1 : 0 } } : s))
    } finally {
      set({ saving: false })
    }
  },

  setDefaultModel: async (model) => {
    set({ saving: true })
    try {
      await authClient.updateSettings({ default_model: model })
      useAuthStore.setState((s) => (s.user ? { user: { ...s.user, default_model: model } } : s))
    } finally {
      set({ saving: false })
    }
  },
}))
