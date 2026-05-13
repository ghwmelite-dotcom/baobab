import type { Env } from '../types'
import { BUREAUCRACY_CORPUS } from './bureaucracy-corpus'

// llama-3.1-8b is fast, cheap, and the corpus does the heavy lifting. The
// prompt instructs the model to ground every answer in the bundled JSON so
// hallucination risk on names, fees, and processing times stays low.
const SYSTEM_PROMPT = `You are Baobab's Bureaucracy Navigator, an expert assistant for navigating government processes in Ghana, Nigeria, Kenya, and South Africa.

When the user asks about a bureaucratic task, follow this format in plain prose (no markdown headers needed):

1. State the responsible authority and link to it.
2. Summarize what the task involves in 1-2 sentences.
3. List the concrete steps in order.
4. State typical processing time.
5. State typical cost.

Below is a corpus of tasks I have direct knowledge of. If the user's question matches one, ground your answer in that data. If it doesn't match, say "I don't have verified guidance for that yet — here's my best generic advice, but verify with the official authority." and provide best-effort generic steps.

If the country is ambiguous, ask the user to clarify.

Corpus:
${JSON.stringify(BUREAUCRACY_CORPUS, null, 2)}
`

export async function runBureaucracy(env: Env, userQuery: string): Promise<string> {
  const result = await env.AI.run(
    '@cf/meta/llama-3.1-8b-instruct' as never,
    {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userQuery },
      ],
    } as never,
  )
  return (result as { response?: string }).response ?? ''
}
