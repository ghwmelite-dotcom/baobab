import type { SearchResult } from './useSearchData'
import { ResultEntry } from './ResultEntry'

interface Props {
  results: SearchResult[]
  emptySlot: React.ReactNode
}

export function ResultList({ results, emptySlot }: Props) {
  if (results.length === 0) return <>{emptySlot}</>
  return (
    <section style={{ margin: '0 24px 32px' }}>
      {results.map((r, i) => (
        <ResultEntry key={`${r.url}-${i}`} result={r} />
      ))}
    </section>
  )
}
