import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  translateText: vi.fn(),
}))

vi.mock('~/translate/api', () => ({
  translateText: mocks.translateText,
}))

vi.mock('~/state/persistence', () => ({
  persistence: {
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  },
}))

vi.mock('~/auth/api', () => ({
  authClient: {},
  client: { setAccessToken: vi.fn() },
}))

// SpeechSynthesis isn't implemented in jsdom — stub the global so the "Speak it"
// button can be exercised without throwing. We don't assert on it here, but
// keeping the stub keeps the panel render path clean.
class StubUtterance {
  text: string
  lang = ''
  constructor(text: string) { this.text = text }
}
const g = globalThis as unknown as { SpeechSynthesisUtterance: typeof StubUtterance }
g.SpeechSynthesisUtterance = StubUtterance
const w = window as unknown as { speechSynthesis: { speak: () => void; cancel: () => void } }
w.speechSynthesis = { speak: () => undefined, cancel: () => undefined }

import { TranslatePad } from '~/translate/TranslatePad'
import { useTranslateStore } from '~/translate/translate.store'

beforeEach(() => {
  useTranslateStore.setState({
    open: true,
    sourceLang: 'auto',
    targetLang: 'yo',
    sourceText: '',
    translatedText: '',
    loading: false,
    error: null,
  })
  mocks.translateText.mockReset()
})

describe('TranslatePad', () => {
  it('translates text and renders the result', async () => {
    mocks.translateText.mockResolvedValueOnce({
      translatedText: 'Ẹ káàárọ̀.',
      detectedSourceLang: 'en',
      model: 'm2m100',
    })

    render(<TranslatePad />)

    const source = screen.getByPlaceholderText(/type or paste text/i) as HTMLTextAreaElement
    fireEvent.change(source, { target: { value: 'Good morning.' } })

    fireEvent.click(screen.getByRole('button', { name: /^translate$/i }))

    await waitFor(() => {
      const target = screen.getByPlaceholderText(/translation will appear here/i) as HTMLTextAreaElement
      expect(target.value).toBe('Ẹ káàárọ̀.')
    })
    expect(mocks.translateText).toHaveBeenCalledWith({
      text: 'Good morning.',
      sourceLang: undefined,
      targetLang: 'yo',
    })
  })

  it('swaps source and target languages', async () => {
    // Start with two non-auto langs so the swap is unambiguous.
    act(() => {
      useTranslateStore.setState({
        sourceLang: 'en',
        targetLang: 'yo',
        sourceText: 'Hello',
        translatedText: 'Ẹ kú àárọ̀',
      })
    })

    render(<TranslatePad />)
    fireEvent.click(screen.getByRole('button', { name: /swap languages/i }))

    const state = useTranslateStore.getState()
    expect(state.sourceLang).toBe('yo')
    expect(state.targetLang).toBe('en')
    expect(state.sourceText).toBe('Ẹ kú àárọ̀')
    expect(state.translatedText).toBe('Hello')
  })

  it('returns null when closed', () => {
    act(() => useTranslateStore.setState({ open: false }))
    const { container } = render(<TranslatePad />)
    expect(container.firstChild).toBeNull()
  })

  it('closes on Escape', async () => {
    render(<TranslatePad />)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(useTranslateStore.getState().open).toBe(false))
  })
})
