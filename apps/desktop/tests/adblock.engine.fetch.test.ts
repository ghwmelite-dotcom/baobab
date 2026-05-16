import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Load the actual engine.js source the Rust side bundles. Keeping this
// test pointed at the on-disk file guards against the original bug coming
// back: the hook used to forward the caller's `this`, which threw
// "Illegal invocation" the moment a class method (e.g. BaobabClient's
// `fetchFn`) invoked the hooked fetch.
const ENGINE_SRC = readFileSync(
  join(process.cwd(), 'src-tauri', 'resources', 'adblock', 'engine.js'),
  'utf8',
)

interface BaobabAdblockGlobal {
  blockedHostnames: string[]
  youtubeScriptlets: string
  lastUpdated: string
  source: { kind: 'Bundled' }
}

declare global {
  // eslint-disable-next-line no-var
  var BAOBAB_ADBLOCK: BaobabAdblockGlobal | undefined
}

function installEngine(): void {
  globalThis.BAOBAB_ADBLOCK = {
    blockedHostnames: ['tracker.example'],
    youtubeScriptlets: '',
    lastUpdated: '2026-05-16T00:00:00Z',
    source: { kind: 'Bundled' },
  }
  // Replace the YT placeholder so eval doesn't choke on the marker comment.
  const src = ENGINE_SRC.replace(
    '/* BAOBAB_YT_SCRIPTLETS_INJECTED_HERE */',
    '',
  )
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(src).call(globalThis)
}

describe('adblock engine: fetch hook receiver', () => {
  let originalFetch: typeof fetch
  beforeEach(() => {
    originalFetch = globalThis.fetch
    // Reset between tests by restoring the un-hooked fetch.
    globalThis.fetch = (() => Promise.resolve(new Response('ok'))) as typeof fetch
  })

  it('does not throw "Illegal invocation" when called from a method context', async () => {
    installEngine()

    // Simulate the BaobabClient pattern: hold fetch on an instance and
    // call it via `this.fetchFn(...)`. Pre-fix, this raised:
    //   TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation
    class Client {
      fetchFn = globalThis.fetch
      hit(url: string) {
        return this.fetchFn(url)
      }
    }

    const c = new Client()
    const res = await c.hit('https://baobab-api.example/api/ai/search')
    expect(res).toBeInstanceOf(Response)

    globalThis.fetch = originalFetch
  })

  it('still rejects blocked hostnames', async () => {
    installEngine()

    await expect(globalThis.fetch('https://tracker.example/pixel')).rejects.toThrow(
      /Blocked by Baobab ad-blocker/,
    )

    globalThis.fetch = originalFetch
  })
})
