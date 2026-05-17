import { countryFor, isAfrican } from './search-rank'

export interface PseResultLike {
  title: string
  url: string
  snippet: string
  source: string
}

export interface AnnotatedResult extends PseResultLike {
  isAfrican: boolean
  country: string | null
}

/** Stable-sort: African results first (preserving PSE order within), then
 *  non-African (also preserving PSE order). Adds `isAfrican` + `country`
 *  annotations to every entry. */
export function rerank(results: PseResultLike[]): AnnotatedResult[] {
  const annotated: AnnotatedResult[] = results.map((r) => ({
    ...r,
    isAfrican: isAfrican(r.source),
    country: countryFor(r.source),
  }))
  return annotated
    .map((r, idx) => ({ r, idx }))
    .sort((a, b) => {
      if (a.r.isAfrican && !b.r.isAfrican) return -1
      if (!a.r.isAfrican && b.r.isAfrican) return 1
      return a.idx - b.idx
    })
    .map(({ r }) => r)
}
