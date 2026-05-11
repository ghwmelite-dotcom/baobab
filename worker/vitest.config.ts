import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrations = await readD1Migrations(path.join(__dirname, 'db/migrations'))

// Stub the Workers AI binding for tests. Miniflare can't emulate Workers AI
// locally (the wrangler-injected wrapped binding tries to resolve
// `cloudflare-internal:ai-api`, which doesn't exist in the local runtime).
// We override the `AI` wrapped binding with a tiny local worker that exposes
// the same shape (`.run(model, input)`) and returns canned responses.
// Tests that need richer behavior can still patch `env.AI` further at
// runtime via setup helpers (see test/ai-mock.ts).
const AI_STUB_WORKER = `
export default function () {
  return {
    async run(_model, input) {
      if (Array.isArray(input?.text)) {
        return { data: [Array.from({ length: 8 }, (_, i) => i * 0.1)] }
      }
      if (input?.stream) {
        const encoder = new TextEncoder()
        return new ReadableStream({
          start(c) { c.enqueue(encoder.encode('ok')); c.close() }
        })
      }
      return { response: 'ok' }
    }
  }
}
`

export default defineWorkersConfig({
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            AUTH_SECRET: 'test-secret-do-not-use-in-prod',
            ENCRYPTION_KEY: 'test-encryption-key',
            ADMIN_API_KEY: 'test-admin',
          },
          workers: [
            {
              name: '__ai_stub_worker',
              modules: [
                {
                  type: 'ESModule',
                  path: 'index.mjs',
                  contents: AI_STUB_WORKER,
                },
              ],
            },
          ],
          wrappedBindings: {
            AI: { scriptName: '__ai_stub_worker' },
          },
        },
      },
    },
  },
})
