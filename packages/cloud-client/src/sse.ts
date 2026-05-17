export interface SseEvent {
  kind: 'data' | 'done'
  raw: string
  json?: Record<string, unknown>
}

export async function* parseSseStream(stream: ReadableStream<Uint8Array>): AsyncIterableIterator<SseEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') {
            yield { kind: 'done', raw: data }
          } else {
            let json: Record<string, unknown> | undefined
            try { json = JSON.parse(data) as Record<string, unknown> } catch { /* skip malformed */ }
            yield { kind: 'data', raw: data, json }
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
