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
    async run(model, input) {
      if (Array.isArray(input?.text)) {
        return { data: [Array.from({ length: 8 }, (_, i) => i * 0.1)] }
      }
      if (input?.stream) {
        const encoder = new TextEncoder()
        return new ReadableStream({
          start(c) { c.enqueue(encoder.encode('ok')); c.close() }
        })
      }
      // m2m100-style translation input: { text, source_lang, target_lang }
      if (typeof input?.text === 'string' && typeof input?.target_lang === 'string') {
        // Sentinel target lang lets the translate-route fallback test simulate
        // an m2m100 failure so the llama branch is exercised.
        if (input.target_lang === 'fail') {
          throw new Error('m2m100 unavailable (test sentinel)')
        }
        if (input.target_lang === 'yo') {
          // Escape Yoruba diacritics so the literal survives any encoding hops
          // between this config file, the worker bundler, and the test runner.
          return { translated_text: '\\u1EB8 k\\u00E1\\u00E0\\u00E1r\\u1ECD\\u0300.' }
        }
        return { translated_text: '[' + input.target_lang + '] ' + input.text }
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
