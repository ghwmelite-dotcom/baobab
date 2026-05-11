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

export async function runChatStream(env: Env, model: string, messages: ChatMessage[]): Promise<ReadableStream> {
  const result = await env.AI.run(model as keyof AiModels, { messages, max_tokens: 2048, stream: true } as never)
  return result as unknown as ReadableStream
}

export async function embedQuery(env: Env, text: string): Promise<number[]> {
  const r = await env.AI.run(env.EMBEDDING_MODEL as keyof AiModels, { text: [text] } as never) as { data: number[][] }
  return r.data[0] ?? []
}

type AiModels = Record<string, unknown>
