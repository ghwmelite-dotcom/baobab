import { create } from 'zustand'
import { profileApi, type Profile } from '~/profiles/profile.api'
import type { FruitColor } from '~/profiles/fruitColors'

interface PickerState {
  profiles: Profile[]
  showOnStartup: boolean
  loading: boolean
  error: string | null
  hydrate: () => Promise<void>
  create: (name: string, color?: FruitColor) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  delete: (id: string) => Promise<void>
  toggleShowOnStartup: (value: boolean) => Promise<void>
  select: (id: string) => Promise<void>
  openGuest: () => Promise<void>
}

export const usePickerData = create<PickerState>((set, get) => ({
  profiles: [],
  showOnStartup: false,
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const [profiles, prefs] = await Promise.all([profileApi.list(), profileApi.pickerPrefs()])
      set({ profiles, showOnStartup: prefs.showOnStartup, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'failed to load profiles' })
    }
  },

  create: async (name, color) => {
    await profileApi.create(name, color)
    await get().hydrate()
  },

  rename: async (id, name) => {
    await profileApi.rename(id, name)
    await get().hydrate()
  },

  delete: async (id) => {
    await profileApi.delete(id)
    await get().hydrate()
  },

  toggleShowOnStartup: async (value) => {
    await profileApi.setShowOnStartup(value)
    set({ showOnStartup: value })
  },

  select: async (id) => {
    await profileApi.openProfileWindow(id)
  },

  openGuest: async () => {
    await profileApi.openGuestWindow()
  },
}))
