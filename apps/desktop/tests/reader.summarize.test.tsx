import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { SummarizePill } from '~/reader-app/SummarizePill'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('<SummarizePill>', () => {
  it('renders the "+ Summarize" button', () => {
    render(<SummarizePill text="Body text" onSummary={() => {}} />)
    expect(screen.getByRole('button', { name: /summarize/i })).toBeInTheDocument()
  })

  it('fires onSummary with the AI response on click', async () => {
    const onSummary = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ summary: '3-sentence summary.' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })))
    render(<SummarizePill text="Body text" onSummary={onSummary} />)
    fireEvent.click(screen.getByRole('button', { name: /summarize/i }))
    await waitFor(() => expect(onSummary).toHaveBeenCalledWith('3-sentence summary.'))
  })

  it('shows error state on AI 5xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 502 })))
    render(<SummarizePill text="Body text" onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /summarize/i }))
    await waitFor(() => expect(screen.getByText(/couldn't summarize/i)).toBeInTheDocument())
  })

  it('is disabled while a request is in flight', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))   // never resolves
    render(<SummarizePill text="Body text" onSummary={() => {}} />)
    const btn = screen.getByRole('button', { name: /summarize/i })
    fireEvent.click(btn)
    await waitFor(() => expect(btn).toBeDisabled())
  })
})
