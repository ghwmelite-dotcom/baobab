import { useEffect } from 'react'
import { SearchHeader } from './SearchHeader'
import { AnswerCard } from './AnswerCard'
import { ResultList } from './ResultList'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'
import { useSearchData } from './useSearchData'

function readQueryFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('q') ?? ''
  } catch {
    return ''
  }
}

export function SearchApp() {
  const status = useSearchData((s) => s.status)
  const query = useSearchData((s) => s.query)
  const answer = useSearchData((s) => s.answer)
  const results = useSearchData((s) => s.results)
  const error = useSearchData((s) => s.error)
  const runSearch = useSearchData((s) => s.runSearch)

  // Initial load: read ?q= and run the search.
  useEffect(() => {
    const q = readQueryFromUrl()
    if (q) void runSearch(q)
  }, [runSearch])

  // Listen for browser back/forward navigations that change ?q=.
  useEffect(() => {
    function onPop() {
      const q = readQueryFromUrl()
      if (q) void runSearch(q)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [runSearch])

  function handleRefine(next: string) {
    const encoded = encodeURIComponent(next)
    window.history.pushState(null, '', `${window.location.pathname}?q=${encoded}`)
    void runSearch(next)
  }

  function handleRetry() {
    if (query) void runSearch(query)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #fde7c4 0%, #f4d8a8 40%, #fffaf2 100%)',
        color: '#3c1810',
      }}
    >
      <SearchHeader query={query} onRefine={handleRefine} />

      {status === 'loading' && <LoadingState />}

      {status === 'error' && error === 'auth_required' && (
        <ErrorState variant="auth_required" />
      )}

      {status === 'error' && error === 'unavailable' && (
        <ErrorState variant="unavailable" onRetry={handleRetry} />
      )}

      {status === 'success' && (
        <>
          <AnswerCard answer={answer} />
          <ResultList
            results={results}
            emptySlot={!answer ? <EmptyState query={query} /> : null}
          />
        </>
      )}
    </div>
  )
}
