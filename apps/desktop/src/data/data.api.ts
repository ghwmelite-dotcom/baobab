import { invoke } from '@tauri-apps/api/core'

export const dataApi = {
  setSlowMode: (on: boolean): Promise<void> => invoke('set_slow_mode', { on }),
}
