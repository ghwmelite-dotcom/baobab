import { applyD1Migrations, env } from 'cloudflare:test'
import { beforeAll } from 'vitest'
import type { Env } from '../src/types'

// D1Migration isn't exported from @cloudflare/workers-types in this version;
// inferring from applyD1Migrations' second parameter so the type stays in
// sync with whatever the runtime helper expects.
type Migrations = Parameters<typeof applyD1Migrations>[1]

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: Migrations
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
})
