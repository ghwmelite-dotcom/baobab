import { persistence, profileScoped } from '~/state/persistence'

const MIGRATION_FLAG = 'frontend.migration.v1.completed'
const LEGACY_KEYS = ['auth.accessToken', 'auth.refreshToken'] as const

/**
 * One-shot migration: copy flat `auth.*` keys written by pre-profile builds
 * into the profile-scoped namespace (`profile.<id>.auth.*`), then delete the
 * originals. Guarded by a flag so it only runs once per installation.
 *
 * Skip for guest — guest sessions are ephemeral and never had persisted auth.
 */
export async function migrateLegacyAuthKeys(profileId: string): Promise<void> {
  if (profileId === 'guest') return

  const done = await persistence.get<boolean>(MIGRATION_FLAG)
  if (done) return

  const scoped = profileScoped(profileId)
  for (const k of LEGACY_KEYS) {
    const v = await persistence.get<string>(k)
    if (v !== undefined) {
      await scoped.set(k, v)
      await persistence.delete(k)
    }
  }

  await persistence.set(MIGRATION_FLAG, true)
}
