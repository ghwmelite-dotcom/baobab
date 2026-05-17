import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const aiMocks = vi.hoisted(() => ({
  search: vi.fn(),
}))
vi.mock('~/ai/api', () => ({
  aiClient: aiMocks,
}))

import { SearchApp } from '~/search/SearchApp'
import { useSearchData } from '~/search/useSearchData'

beforeEach(() => {
  aiMocks.search.mockReset()
  window.history.replaceState(null, '', '/search.html?q=baobab')
  useSearchData.setState({
    query: '',
    status: 'idle',
    answer: '',
    results: [],
    error: null,
    requestId: 0,
  })
})

describe('SearchApp', () => {
  it('reads ?q= and renders results when worker succeeds', async () => {
    aiMocks.search.mockResolvedValue({
      answer: 'Baobab is a tree.',
      results: [{ title: 'Wikipedia', url: 'https://wikipedia.org/wiki/Baobab' }],
    })
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByText('Baobab is a tree.')).toBeInTheDocument()
      expect(screen.getByText('Wikipedia')).toBeInTheDocument()
    })
  })

  it('shows empty state when both answer and results are empty', async () => {
    aiMocks.search.mockResolvedValue({ answer: '', results: [] })
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByText(/no grove results for/i)).toBeInTheDocument()
    })
  })

  it('shows auth_required error state on 401', async () => {
    aiMocks.search.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))
    render(<SearchApp />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/sign in to use grove search/i)
    })
  })
})
