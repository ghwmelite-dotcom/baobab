import { extractJson } from './ai'
import type { AnnotatedResult } from './africaRank'

const SEARCH_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const MAX_CITATIONS = 6

export interface Citation {
  name: string
  country: string
  url?: string
  type: 'scholar' | 'publication' | 'institution'
}

export interface SourceContext { url: string; title: string }
export interface ContextChainEntry { query: string; answer: string }

export interface SynthesizeResult {
  answer: string
  citations: Citation[]
}

/** Construct the LLM prompt. Exposed for testing — the prompt is the
 *  load-bearing piece that controls answer quality. */
export function buildPrompt(
  query: string,
  results: AnnotatedResult[],
  contextChain: ContextChainEntry[],
  source?: SourceContext,
): string {
  const sourcesBlock = results
    .map((r, i) => `[${i + 1}] ${r.source}${r.isAfrican ? ' (African)' : ''} — ${r.title}`)
    .join('\n')

  const contextBlock = contextChain.length
    ? '\nPrior conversation:\n' +
      contextChain.map((c) => `Q: ${c.query}\nA: ${c.answer}`).join('\n\n') +
      '\n'
    : ''

  const sourceBlock = source
    ? `\nThe user is currently reading "${source.title}" (${source.url}). The query asks about something in that page.\n`
    : ''

  return [
    'You are Baobab Search, the search engine of an Africa-first browser.',
    'Reply with a JSON object and NOTHING ELSE. No preamble, no code fence.',
    '',
    'Schema: {"answer":"2-4 sentence direct answer","citations":[{"name":"...","country":"ISO-3166-alpha2-or-PAN","type":"scholar|publication|institution","url":"optional"}]}',
    '',
    'Rules:',
    '- Prefer African experts, scholars, publications, and institutions when citing.',
    '- Cite real people and organisations by name. Country is their primary country.',
    '- Use "PAN" for pan-African institutions (African Union, ECOWAS, etc.).',
    '- Up to 6 citations. Skip if you have no real names.',
    '- The answer must stand alone without requiring the user to read the citations.',
    contextBlock,
    sourceBlock,
    'Available sources (use these for context, may cite them as publications):',
    sourcesBlock,
    '',
    `Question: ${query}`,
  ].join('\n')
}

interface AiBinding {
  run(model: string, input: { prompt: string; max_tokens?: number }): Promise<{ response?: string }>
}

export async function synthesize(
  ai: AiBinding,
  query: string,
  results: AnnotatedResult[],
  contextChain: ContextChainEntry[],
  source?: SourceContext,
): Promise<SynthesizeResult> {
  const prompt = buildPrompt(query, results, contextChain, source)

  let raw: string
  try {
    const out = await ai.run(SEARCH_MODEL, { prompt, max_tokens: 700 })
    raw = out.response ?? ''
  } catch {
    return { answer: '', citations: [] }
  }

  const parsed = extractJson<{ answer: string; citations: Citation[] }>(raw)
  if (!parsed) return { answer: '', citations: [] }

  const knownUrls = new Set(results.map((r) => r.url))
  const validated = (parsed.citations ?? [])
    .filter((c) => c && typeof c.name === 'string' && c.name.length > 0)
    .filter((c) => !c.url || knownUrls.has(c.url))
    .slice(0, MAX_CITATIONS)

  return {
    answer: typeof parsed.answer === 'string' ? parsed.answer : '',
    citations: validated,
  }
}
