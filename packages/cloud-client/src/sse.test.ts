import { describe, it, expect } from 'vitest'
import { parseSseStream } from './sse'

function streamFromString(s: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(c) { c.enqueue(encoder.encode(s)); c.close() }
  })
}

describe('parseSseStream', () => {
  it('yields data payloads as parsed objects, concatenating to the streamed text', async () => {
    const raw = 'data: {"response":"Hel"}\n\ndata: {"response":"lo"}\n\ndata: [DONE]\n\n'
    const events: string[] = []
    for await (const ev of parseSseStream(streamFromString(raw))) {
      if (ev.kind === 'data' && typeof ev.json?.response === 'string') events.push(ev.json.response as string)
    }
    expect(events.join('')).toBe('Hello')
  })

  it('emits a done event for [DONE]', async () => {
    const raw = 'data: [DONE]\n\n'
    const kinds: string[] = []
    for await (const ev of parseSseStream(streamFromString(raw))) kinds.push(ev.kind)
    expect(kinds).toEqual(['done'])
  })

  it('skips malformed data lines without throwing', async () => {
    const raw = 'data: not-json\n\ndata: {"response":"ok"}\n\n'
    const tokens: string[] = []
    for await (const ev of parseSseStream(streamFromString(raw))) {
      if (ev.kind === 'data' && ev.json) tokens.push(ev.json.response as string)
    }
    expect(tokens).toEqual(['ok'])
  })
})
