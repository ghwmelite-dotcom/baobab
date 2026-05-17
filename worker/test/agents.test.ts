import { describe, expect, it } from 'vitest'
import { SELF } from 'cloudflare:test'

// The AI binding is stubbed globally in vitest.config.ts. For chat-shaped
// invocations the stub returns `{ response: 'ok' }`, so the agent route
// should surface that as the `answer` field. This proves the route reaches
// env.AI.run and unpacks the model's reply correctly.

describe('POST /api/agents/bureaucracy', () => {
  it('returns the agent answer for a valid query', async () => {
    const r = await SELF.fetch('http://baobab/api/agents/bureaucracy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'How do I register a business in Ghana?' }),
    })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { answer: string }
    expect(typeof j.answer).toBe('string')
    expect(j.answer.length).toBeGreaterThan(0)
  })

  it('rejects empty/whitespace query with 400', async () => {
    const r = await SELF.fetch('http://baobab/api/agents/bureaucracy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '   ' }),
    })
    expect(r.status).toBe(400)
  })

  it('rejects missing query with 400', async () => {
    const r = await SELF.fetch('http://baobab/api/agents/bureaucracy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(r.status).toBe(400)
  })
})
