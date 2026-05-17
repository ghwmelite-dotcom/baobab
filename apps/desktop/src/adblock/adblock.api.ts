import { invoke } from '@tauri-apps/api/core'

export type AdblockSource =
  | { kind: 'Bundled' }
  | { kind: 'Upstream'; fetchedAt: string }

export interface AdblockState {
  enabled: boolean
  lastUpdated: string
  source: AdblockSource
}

export const adblockApi = {
  getState: (profileId: string) => invoke<AdblockState>('cmd_adblock_get_state', { profileId }),
  setEnabled: (profileId: string, enabled: boolean) =>
    invoke<void>('cmd_adblock_set_enabled', { profileId, enabled }),
  refreshLists: () => invoke<AdblockState>('cmd_adblock_refresh_lists'),
}
