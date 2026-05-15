import { invoke } from '@tauri-apps/api/core'
import type { FruitColor } from './fruitColors'

export interface Profile {
  id: string
  name: string
  fruitColor: FruitColor
  avatarLetter: string
  createdAt: string
  lastUsedAt: string
  cloudLink: null | {
    baobabUserId: string
    accountEmail: string | null
    accountPhone: string | null
    linkedAt: string
  }
  userDataDirName: string
  pinRequired: boolean
}

export interface PickerPrefs {
  showOnStartup: boolean
  lastUsedProfileId: string | null
}

export const profileApi = {
  list: () => invoke<Profile[]>('cmd_list_profiles'),
  pickerPrefs: () => invoke<PickerPrefs>('cmd_get_picker_prefs'),
  create: (name: string, fruitColor?: FruitColor, pin?: string) =>
    invoke<Profile>('cmd_create_profile', { name, fruitColor: fruitColor ?? null, pin: pin ?? null }),
  rename: (id: string, name: string) => invoke<void>('cmd_rename_profile', { id, name }),
  updateColor: (id: string, color: FruitColor) =>
    invoke<void>('cmd_update_profile_color', { id, color }),
  delete: (id: string) => invoke<void>('cmd_delete_profile', { id }),
  setShowOnStartup: (value: boolean) => invoke<void>('cmd_set_show_on_startup', { value }),
  recordUsed: (id: string) => invoke<void>('cmd_record_profile_used', { id }),
  setPin: (id: string, newPin: string, currentPin?: string) =>
    invoke<void>('cmd_set_profile_pin', { id, newPin, currentPin: currentPin ?? null }),
  removePin: (id: string, currentPin: string) =>
    invoke<void>('cmd_remove_profile_pin', { id, currentPin }),
  openProfileWindow: (profileId: string, pin?: string) =>
    invoke<void>('open_profile_window', { profileId, pin: pin ?? null }),
  openPickerWindow: () => invoke<void>('open_picker_window'),
  openGuestWindow: () => invoke<void>('open_guest_window'),
  currentProfileId: () => invoke<string | null>('current_profile_id'),
}
