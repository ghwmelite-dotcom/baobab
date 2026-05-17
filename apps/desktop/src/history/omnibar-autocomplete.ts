import type { HistoryItem } from '@baobab/cloud-client'
import { historyClient } from './api'

let lastQuery = ''
let lastResults: HistoryItem[] = []
let inflight: Promise<HistoryItem[]> | null = null

export async function suggest(q: string, limit = 5): Promise<HistoryItem[]> {
  const trimmed = q.trim()
  if (!trimmed) return []
  if (trimmed === lastQuery && lastResults.length > 0) return lastResults.slice(0, limit)
  if (inflight) return (await inflight).slice(0, limit)
  inflight = historyClient.list({ q: trimmed, limit }).then((r) => {
    lastResults = r.items
    lastQuery = trimmed
    return r.items
  }).finally(() => { inflight = null })
  return (await inflight).slice(0, limit)
}
