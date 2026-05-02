import { applyD1Migrations, env } from 'cloudflare:test'
import type { D1Migration } from '@cloudflare/workers-types'
import { beforeAll } from 'vitest'

declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    TEST_MIGRATIONS: D1Migration[]
  }
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
})
