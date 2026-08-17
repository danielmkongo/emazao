import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import sw from './locales/sw.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      sw: { translation: sw },
    },
    // English is the deliberate default rather than the browser's language:
    // buyers are frequently international (Dubai, Riyadh) while the Swahili
    // audience is largely the Tanzanian seller side, so a wrong auto-guess is
    // more disruptive than a consistent starting point the user can change.
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    // A missing Swahili key falls back to English rather than rendering the raw
    // key. Half-translated money screens are worse than English ones.
    returnEmptyString: false,
    detection: {
      // Explicit choice wins and persists; we do not sniff navigator.language,
      // so nobody is dropped into a partially-translated UI without asking.
      order: ['localStorage'],
      lookupLocalStorage: 'emazao-lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React already escapes
  })

export default i18n
