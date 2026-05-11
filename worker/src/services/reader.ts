import type { Env } from '../types'
import { runChat } from './ai'

export interface ReadablePage {
  title: string
  text: string
  word_count: number
  est_read_minutes: number
  cleaned_html: string
}

export function extractReadable(html: string): ReadablePage {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = (titleMatch?.[1] ?? '').trim()

  let body = html
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')

  const articleMatch = body.match(/<article[\s\S]*?<\/article>/i)
  const mainMatch = body.match(/<main[\s\S]*?<\/main>/i)
  const cleaned_html = articleMatch?.[0] ?? mainMatch?.[0] ?? body

  const text = cleaned_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const word_count = text.split(/\s+/).filter(Boolean).length
  const est_read_minutes = Math.max(1, Math.round(word_count / 220))

  return { title, text, word_count, est_read_minutes, cleaned_html }
}

export async function summarizeAndExtract(env: Env, model: string, page: ReadablePage): Promise<{
  summary: string
  key_points: string[]
}> {
  const reply = await runChat(env, model, [
    {
      role: 'system',
      content:
        'Given the article, output strict JSON: {"summary":"3-sentence summary","key_points":["3-5 bullet points"]}',
    },
    { role: 'user', content: `Title: ${page.title}\n\n${page.text.slice(0, 6000)}` },
  ])
  try {
    return JSON.parse(reply.replace(/^```json\s*|\s*```$/g, ''))
  } catch {
    return { summary: reply.slice(0, 400), key_points: [] }
  }
}
