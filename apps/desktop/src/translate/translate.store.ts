import { create } from 'zustand'
import { translateText } from './api'

interface TranslateState {
  open: boolean
  /** 'auto' or a 2-letter ISO 639-1 code (e.g. 'en', 'yo'). */
  sourceLang: string
  /** A 2-letter ISO 639-1 code (e.g. 'yo'). */
  targetLang: string
  sourceText: string
  translatedText: string
  loading: boolean
  error: string | null
  toggle: () => void
  close: () => void
  setSourceLang: (l: string) => void
  setTargetLang: (l: string) => void
  setSourceText: (t: string) => void
  swapLangs: () => void
  translate: () => Promise<void>
}

export const useTranslateStore = create<TranslateState>()((set, get) => ({
  open: false,
  sourceLang: 'auto',
  targetLang: 'yo',
  sourceText: '',
  translatedText: '',
  loading: false,
  error: null,

  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),

  setSourceLang: (l) => set({ sourceLang: l }),
  setTargetLang: (l) => set({ targetLang: l }),
  setSourceText: (t) => set({ sourceText: t }),

  swapLangs: () => {
    const { sourceLang, targetLang, sourceText, translatedText } = get()
    // 'auto' isn't valid as a target; if the user swaps while source is 'auto',
    // we keep the previous detected/explicit target on the source side and
    // default the new target to English so they can immediately translate back.
    const newSource = targetLang
    const newTarget = sourceLang === 'auto' ? 'en' : sourceLang
    set({
      sourceLang: newSource,
      targetLang: newTarget,
      sourceText: translatedText,
      translatedText: sourceText,
    })
  },

  translate: async () => {
    const { sourceLang, targetLang, sourceText } = get()
    const text = sourceText.trim()
    if (!text) return
    set({ loading: true, error: null })
    try {
      const r = await translateText({
        text,
        sourceLang: sourceLang === 'auto' ? undefined : sourceLang,
        targetLang,
      })
      set({ translatedText: r.translatedText, loading: false })
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'translate failed',
        loading: false,
      })
    }
  },

}))
