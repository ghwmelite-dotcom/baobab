import { describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { runChat, pickModel } from '../src/services/ai'

// The `AI` binding is stubbed at the miniflare layer via vitest.config.ts
// (`wrappedBindings.AI` → `__ai_stub_worker`) because the real Workers AI
// binding can't be emulated locally. The stub returns `{ response: 'ok' }`
// for chat calls, `{ data: [[...]] }` for embeddings, and a ReadableStream
// for streaming calls.

describe('ai service', () => {
  it('pickModel returns LOWBW for low-bandwidth users', () => {
    expect(pickModel(env, { model: env.DEFAULT_MODEL, lowBw: true })).toBe(env.LOWBW_MODEL)
    expect(pickModel(env, { model: env.DEFAULT_MODEL, lowBw: false })).toBe(env.DEFAULT_MODEL)
  })
  it('runChat returns a string response', async () => {
    const reply = await runChat(env, env.LOWBW_MODEL, [
      { role: 'system', content: 'you are concise' },
      { role: 'user', content: 'say "ok"' },
    ])
    expect(typeof reply).toBe('string')
    expect(reply.length).toBeGreaterThan(0)
  })
})
