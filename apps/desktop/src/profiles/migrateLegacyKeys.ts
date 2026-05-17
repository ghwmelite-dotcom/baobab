import { persistence, profileScoped } from '~/state/persistence'

const MIGRATION_FLAG = 'frontend.migration.v1.completed'
const LEGACY_KEYS = ['auth.accessToken', 'auth.refreshToken', 'tabs.snapshot'] as const

export async function migrateLegacyAuthKeys(profileId: string): Promise<void> {
  if (profileId === 'guest') return

  const done = await persistence.get<boolean>(MIGRATION_FLAG)
  if (done) return

  const scoped = profileScoped(profileId)
  for (const k of LEGACY_KEYS) {
    const v = await persistence.get<unknown>(k)
    if (v !== undefined) {
      await scoped.set(k, v)
      await persistence.delete(k)
    }
  }

  await persistence.set(MIGRATION_FLAG, true)
}
