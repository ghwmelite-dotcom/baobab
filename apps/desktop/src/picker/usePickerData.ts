import { create } from 'zustand'
import { profileApi, type Profile } from '~/profiles/profile.api'
import type { FruitColor } from '~/profiles/fruitColors'

interface PickerState {
  profiles: Profile[]
  showOnStartup: boolean
  loading: boolean
  error: string | null
  unlockTarget: string | null   // profile id awaiting PIN entry
  hydrate: () => Promise<void>
  create: (name: string, color?: FruitColor, pin?: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  delete: (id: string) => Promise<void>
  toggleShowOnStartup: (value: boolean) => Promise<void>
  select: (id: string) => Promise<void>
  clearUnlockTarget: () => void
  setPin: (id: string, newPin: string, currentPin?: string) => Promise<void>
  removePin: (id: string, currentPin: string) => Promise<void>
  openGuest: () => Promise<void>
}

export const usePickerData = create<PickerState>((set, get) => ({
  profiles: [],
  showOnStartup: false,
  loading: false,
  error: null,
  unlockTarget: null,

  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const [profiles, prefs] = await Promise.all([profileApi.list(), profileApi.pickerPrefs()])
      set({ profiles, showOnStartup: prefs.showOnStartup, loading: false })
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'failed to load profiles' })
    }
  },

  create: async (name, color, pin) => {
    await profileApi.create(name, color, pin)
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
    const p = get().profiles.find((x) => x.id === id)
    if (p?.pinRequired) {
      set({ unlockTarget: id })
      return
    }
    await profileApi.openProfileWindow(id)
  },

  clearUnlockTarget: () => set({ unlockTarget: null }),

  setPin: async (id, newPin, currentPin) => {
    await profileApi.setPin(id, newPin, currentPin)
    await get().hydrate()
  },

  removePin: async (id, currentPin) => {
    await profileApi.removePin(id, currentPin)
    await get().hydrate()
  },

  openGuest: async () => {
    await profileApi.openGuestWindow()
  },
}))
