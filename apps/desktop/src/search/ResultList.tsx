import type { SearchResult } from '@baobab/cloud-client'
import { ResultEntry } from './ResultEntry'
import type { ReactNode } from 'react'

export function ResultList({
  results, emptySlot,
}: { results: SearchResult[]; emptySlot?: ReactNode }) {
  if (results.length === 0) return <>{emptySlot}</>
  return (
    <div>
      <div style={{ fontSize: 13, color: '#6f4a2c', marginBottom: 12, fontWeight: 500 }}>
        {results.length} supporting source{results.length === 1 ? '' : 's'}
      </div>
      {results.map((r) => <ResultEntry key={r.url} result={r} />)}
    </div>
  )
}
