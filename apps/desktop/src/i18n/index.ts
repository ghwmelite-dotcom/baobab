import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import yo from './locales/yo.json'
import sw from './locales/sw.json'
import ha from './locales/ha.json'

export const SUPPORTED_LANGUAGES = ['en', 'yo', 'sw', 'ha'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_META: Record<SupportedLanguage, { name: string; isStub: boolean }> = {
  en: { name: 'English', isStub: false },
  yo: { name: 'Yoruba', isStub: true },
  sw: { name: 'Swahili', isStub: true },
  ha: { name: 'Hausa', isStub: true },
}

// Eager resources — JSON imported at build time so no Suspense boundary is needed.
// Stub locales (yo/sw/ha) intentionally contain only `_meta`; every other key
// falls back to English via `fallbackLng`.
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      yo: { translation: yo },
      sw: { translation: sw },
      ha: { translation: ha },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'baobab.lang',
      caches: ['localStorage'],
    },
    returnNull: false,
  })

export default i18n
