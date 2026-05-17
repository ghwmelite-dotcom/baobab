import type { Env } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export function pickModel(env: Env, opts: { model?: string; lowBw?: boolean }): string {
  if (opts.lowBw) return env.LOWBW_MODEL
  return opts.model ?? env.DEFAULT_MODEL
}

export async function runChat(env: Env, model: string, messages: ChatMessage[]): Promise<string> {
  const result = await env.AI.run(model as keyof AiModels, { messages, max_tokens: 2048 } as never) as { response?: string }
  return result.response ?? ''
}

// Force the model to emit strict JSON via Workers AI's structured-output
// `response_format: { type: 'json_schema', json_schema }` hint. Llama-3.1-8b
// in particular has been observed to emit invalid JSON in free-form
// prompts; passing a schema constrains the decoder.
//
// `schema` is a JSON Schema object describing the expected shape.
export async function runChatJson<T>(
  env: Env,
  model: string,
  messages: ChatMessage[],
  schema: object,
  schemaName = 'response',
): Promise<T | null> {
  const result = await env.AI.run(model as keyof AiModels, {
    messages,
    max_tokens: 2048,
    response_format: {
      type: 'json_schema',
      json_schema: { name: schemaName, schema },
    },
  } as never) as { response?: string }
  const raw = result.response ?? ''
  return extractJson<T>(raw)
}

export async function runChatStream(env: Env, model: string, messages: ChatMessage[]): Promise<ReadableStream> {
  const result = await env.AI.run(model as keyof AiModels, { messages, max_tokens: 2048, stream: true } as never)
  return result as unknown as ReadableStream
}

export async function embedQuery(env: Env, text: string): Promise<number[]> {
  const r = await env.AI.run(env.EMBEDDING_MODEL as keyof AiModels, { text: [text] } as never) as { data: number[][] }
  return r.data[0] ?? []
}

// Workers AI llama models exhibit two failure modes on JSON output:
// (1) prose preamble before the JSON, and (2) double-wrapping where the
// model puts its intended JSON inside a string field of an outer JSON
// object ({"summary":"Here is:\n\n{\"summary\":\"actual\"...}"...}).
//
// This extractor handles both: it slices the outermost {…}/[…], parses
// it, and then if any string field of the result contains an embedded
// JSON object with the same shape, prefers the inner one.
export function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```\s*$/g, '').trim()

  const candidates: string[] = []
  // First try the whole cleaned string.
  candidates.push(cleaned)
  // Then try slicing each bracket pair (handles prose preamble/postamble).
  for (const [openCh, closeCh] of [['{', '}'], ['[', ']']] as const) {
    const start = cleaned.indexOf(openCh)
    const end = cleaned.lastIndexOf(closeCh)
    if (start !== -1 && end > start) candidates.push(cleaned.slice(start, end + 1))
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as T
      // Double-wrap unwrap: if any string field of the parsed object
      // contains an embedded JSON object, prefer that.
      const unwrapped = unwrapEmbeddedJson<T>(parsed)
      return unwrapped ?? parsed
    } catch {
      /* try next */
    }
  }
  return null
}

// Walk string fields of an object; if any contains an embedded JSON
// object with the same top-level shape, return that. Recursive to handle
// arbitrarily nested wrapping.
function unwrapEmbeddedJson<T>(obj: unknown): T | null {
  if (!obj || typeof obj !== 'object') return null
  const topKeys = Object.keys(obj as Record<string, unknown>)
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v !== 'string') continue
    if (!v.includes('{')) continue
    const innerOpen = v.indexOf('{')
    const innerClose = v.lastIndexOf('}')
    if (innerClose <= innerOpen) continue
    try {
      const inner = JSON.parse(v.slice(innerOpen, innerClose + 1)) as Record<string, unknown>
      const innerKeys = Object.keys(inner)
      // If the inner shape matches the outer (same top keys), trust it.
      if (innerKeys.some((k) => topKeys.includes(k))) {
        // Recurse once in case it's wrapped twice.
        return (unwrapEmbeddedJson<T>(inner) ?? (inner as unknown as T))
      }
    } catch {
      /* not JSON */
    }
  }
  return null
}

type AiModels = Record<string, unknown>
