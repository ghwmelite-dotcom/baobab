import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ReaderApp } from '~/reader-app/ReaderApp'

function setUrl(search: string): void {
  window.history.replaceState({}, '', '/reader.html' + search)
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('<ReaderApp>', () => {
  it('renders an error pane when ?url= is missing', () => {
    setUrl('')
    render(<ReaderApp />)
    expect(screen.getByText(/no url provided/i)).toBeInTheDocument()
  })

  it('POSTs to /api/proxy/fetch with the decoded url + skip_ai', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        title: 'T', cleaned_html: '<p>Body</p>', text: 'Body', word_count: 50,
        est_read_minutes: 1, ads_blocked: 0, trackers_blocked: 0,
        ai_summary: '', key_points: [], cached: false,
        bytes_saved: 12345, bytes_saved_adblock: 678,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ReaderApp />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const call = fetchMock.mock.calls[0]
    const req = call[0] as Request | string
    const url = typeof req === 'string' ? req : req.url
    expect(url).toContain('/api/proxy/fetch')
    const init = call[1] as RequestInit
    const body = JSON.parse(init.body as string)
    expect(body.url).toBe('https://example.com/article')
    expect(typeof body.skip_ai).toBe('boolean')
    await waitFor(() => expect(screen.getByText('Body')).toBeInTheDocument())
  })

  it('shows the saving header after a successful fetch', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        title: 'T', cleaned_html: '<p>x</p>', text: 'x', word_count: 50,
        est_read_minutes: 1, ads_blocked: 0, trackers_blocked: 0,
        ai_summary: '', key_points: [], cached: false,
        bytes_saved: 1_500_000, bytes_saved_adblock: 100_000,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ReaderApp />)
    await waitFor(() => expect(screen.getByText(/saved ≈/i)).toBeInTheDocument())
    expect(screen.getByText(/1\.5 MB/i)).toBeInTheDocument()
  })

  it('renders an error pane on fetch 5xx with a Load full page link', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 502 })))
    render(<ReaderApp />)
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /load full page/i })).toHaveAttribute('href', 'https://example.com/article')
  })

  it('reports bytes_saved via __TAURI_INTERNALS__.invoke', async () => {
    setUrl('?url=' + encodeURIComponent('https://example.com/article'))
    const invoke = vi.fn(async () => undefined)
    ;(window as Window & { __TAURI_INTERNALS__?: { invoke: (n: string, p: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__ = { invoke }
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({
        title: 'T', cleaned_html: '<p>x</p>', text: 'x', word_count: 50,
        est_read_minutes: 1, ads_blocked: 0, trackers_blocked: 0,
        ai_summary: '', key_points: [], cached: false,
        bytes_saved: 1000, bytes_saved_adblock: 200,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    render(<ReaderApp />)
    await waitFor(() => expect(invoke).toHaveBeenCalled())
    const call = invoke.mock.calls[0]
    expect(call[0]).toBe('record_tab_usage')
    expect(call[1]).toEqual({ bytesUsed: 0, bytesSaved: 1200 })
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  })
})
