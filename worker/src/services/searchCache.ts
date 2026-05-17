async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface ContextEntry { query: string; answer: string }

/** Build a stable cache key from query + target language + contextChain. */
export async function cacheKey(
  query: string,
  targetLanguage: string | null,
  contextChain: ContextEntry[],
): Promise<string> {
  const ctxStr = contextChain.map((c) => `${c.query}::${c.answer}`).join('|')
  const ctxHash = await sha256Hex(ctxStr)
  const composite = `${query.trim().toLowerCase()}|${targetLanguage ?? ''}|${ctxHash}`
  return `search:${await sha256Hex(composite)}`
}

export async function cacheGet<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key)
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

export async function cacheSet<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds })
}
