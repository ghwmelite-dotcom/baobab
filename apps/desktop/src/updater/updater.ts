import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export interface UpdateInfo {
  version: string
  notes?: string
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const u = await check()
    if (!u) return null
    return { version: u.version, notes: u.body ?? undefined }
  } catch {
    return null
  }
}

export async function installAndRelaunch(): Promise<'ok' | 'error'> {
  try {
    const u = await check()
    if (!u) return 'ok'
    await u.downloadAndInstall()
    await relaunch()
    return 'ok'
  } catch {
    return 'error'
  }
}
