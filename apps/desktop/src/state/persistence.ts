import { load, type Store } from '@tauri-apps/plugin-store'

const STORE_FILE = 'baobab.store.json'

let storePromise: Promise<Store> | null = null

function getStore(): Promise<Store> {
  if (!storePromise) storePromise = load(STORE_FILE, { defaults: {}, autoSave: false })
  return storePromise
}

// Keys NOT scoped to a profile — picker preferences, updater state, etc.
export const GLOBAL_KEYS: readonly string[] = [
  'picker.showOnStartup',
  'picker.lastUsedProfileId',
  'updater.lastCheckAt',
  'updater.dismissedVersion',
]

export const persistence = {
  async get<T>(key: string): Promise<T | undefined> {
    const s = await getStore()
    const v = await s.get<T>(key)
    return v ?? undefined
  },
  async set<T>(key: string, value: T): Promise<void> {
    const s = await getStore()
    await s.set(key, value)
    await s.save()
  },
  async delete(key: string): Promise<void> {
    const s = await getStore()
    await s.delete(key)
    await s.save()
  },
}

export function profileScoped(profileId: string) {
  const prefix = `profile.${profileId}.`
  return {
    get<T>(key: string): Promise<T | undefined> {
      return persistence.get<T>(prefix + key)
    },
    set<T>(key: string, value: T): Promise<void> {
      return persistence.set<T>(prefix + key, value)
    },
    delete(key: string): Promise<void> {
      return persistence.delete(prefix + key)
    },
  }
}
