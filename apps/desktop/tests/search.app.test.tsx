import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock @baobab/cloud-client so no real HTTP is made.
// ---------------------------------------------------------------------------
const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }))

vi.mock('@baobab/cloud-client', () => ({
  BaobabClient: vi.fn(() => ({})),
  AiClient: vi.fn(() => ({ search: mockSearch })),
}))

import { SearchApp } from '~/search/SearchApp'
import { useSearchData } from '~/search/useSearchData'

function resetState() {
  useSearchData.setState({
    query: '',
    status: 'idle',
    intent: null,
    answer: null,
    citations: [],
    results: [],
    diversity: null,
    siteCard: null,
    contextChain: [],
    targetLanguage: null,
    error: null,
    errorDetail: undefined,
    meta: null,
  })
}

beforeEach(() => {
  mockSearch.mockReset()
  window.history.replaceState(null, '', '/search.html?q=baobab')
  resetState()
})

describe('SearchApp', () => {
  it('reads ?q= and renders results when worker succeeds', async () => {
    mockSearch.mockResolvedValue({
      intent: 'informational' as const,
      answer: { en: 'Baobab is a tree.' },
      citations: [],
      results: [{ title: 'Wikipedia', url: 'https://wikipedia.org/wiki/Baobab', snippet: '', source: '', country: null, isAfrican: false }],
      diversity: { sourceCount: 1, countryCount: 1, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByText('Baobab is a tree.')).toBeInTheDocument()
      expect(screen.getByText('Wikipedia')).toBeInTheDocument()
    })
  })

  it('shows empty state when both answer and results are empty', async () => {
    mockSearch.mockResolvedValue({
      intent: 'informational' as const,
      answer: null,
      citations: [],
      results: [],
      diversity: { sourceCount: 0, countryCount: 0, africanVoicePercent: 0 },
      meta: { cached: false, pseQueriesRemainingToday: 100 },
    })
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByText(/no grove results for/i)).toBeInTheDocument()
    })
  })

  it('shows auth_required error state on 401', async () => {
    mockSearch.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/sign in to use grove search/i)
    })
  })
})
