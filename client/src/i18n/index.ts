import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ka from './locales/ka.json'

export const LANGUAGES = ['en', 'ka'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'portfolio-lang'

function initialLanguage(): Language {
  let stored: string | null = null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    /* storage blocked — fall back to the browser language */
  }
  if (stored === 'en' || stored === 'ka') return stored
  return navigator.language?.toLowerCase().startsWith('ka') ? 'ka' : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ka: { translation: ka },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    /* storage blocked — the choice just won't persist */
  }
})
document.documentElement.lang = i18n.language

export default i18n
