// Smart parse — design spec §7.1 A2:
//   contains '.' and no spaces → URL, else AI-enhanced search.

export type OmnibarParse =
  | { kind: 'url'; url: string }
  | { kind: 'search'; query: string }
  | { kind: 'empty' }

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

export function parseOmnibarInput(raw: string): OmnibarParse {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { kind: 'empty' }

  if (SCHEME_RE.test(trimmed)) {
    return { kind: 'url', url: trimmed }
  }

  if (!trimmed.includes(' ') && trimmed.includes('.')) {
    return { kind: 'url', url: `https://${trimmed}` }
  }

  return { kind: 'search', query: trimmed }
}
