import { useEffect } from 'react'
import { SearchHeader } from './SearchHeader'
import { AnswerCard } from './AnswerCard'
import { SiteCard } from './SiteCard'
import { DiversityMeter } from './DiversityMeter'
import { RefineBar } from './RefineBar'
import { ResultList } from './ResultList'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { LoadingState } from './LoadingState'
import { useSearchData } from './useSearchData'
import { useAuthStore } from '~/auth/auth.store'

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
  const intent = useSearchData((s) => s.intent)
  const answer = useSearchData((s) => s.answer)
  const citations = useSearchData((s) => s.citations)
  const results = useSearchData((s) => s.results)
  const diversity = useSearchData((s) => s.diversity)
  const siteCard = useSearchData((s) => s.siteCard)
  const error = useSearchData((s) => s.error)
  const errorDetail = useSearchData((s) => s.errorDetail)
  const runSearch = useSearchData((s) => s.runSearch)
  const setTargetLanguage = useSearchData((s) => s.setTargetLanguage)
  const heritage = useAuthStore((s) => s.heritageLanguage)

  // Sync heritage language setting into the search store whenever it changes.
  useEffect(() => {
    setTargetLanguage(heritage ?? null)
  }, [heritage, setTargetLanguage])

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
      data-baobab-surface="grove"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--grove-sky-dawn, #fde7c4) 0%, var(--grove-sky-mist, #f4d8a8) 40%, var(--grove-sky-haze, #fffaf2) 100%)',
        color: 'var(--grove-text-primary)',
      }}
    >
      <SearchHeader query={query} onRefine={handleRefine} />

      <main
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '0 24px 96px',
          boxSizing: 'border-box',
        }}
      >
        {status === 'loading' && <LoadingState />}

        {status === 'error' && error === 'auth_required' && (
          <ErrorState variant="auth_required" detail={errorDetail} />
        )}

        {status === 'error' && error === 'unavailable' && (
          <ErrorState variant="unavailable" onRetry={handleRetry} detail={errorDetail} />
        )}

        {status === 'success' && (
          <>
            {intent === 'navigational' && siteCard && <SiteCard card={siteCard} />}
            {intent === 'informational' && answer && <AnswerCard answer={answer} citations={citations} />}
            {diversity && <DiversityMeter {...diversity} />}
            <ResultList
              results={results}
              emptySlot={!answer ? <EmptyState query={query} /> : null}
            />
            <RefineBar />
          </>
        )}
      </main>
    </div>
  )
}
