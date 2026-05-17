import i18next from 'i18next';
import en from './locales/en.json';

// English is the only locale bundled with the build — it gives users an
// instant first paint without a network round-trip. All other locales are
// fetched at runtime from CFS via `ensureLocaleCurrent()` in runtime-loader.ts.
// See Mentat/planning/I18N_DELIVERY.md.

const LANGUAGE_STORAGE_KEY = 'chp_language';

export function getStoredLanguage(): string {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
}

export function setStoredLanguage(lang: string): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export function hasStoredLanguage(): boolean {
  return !!localStorage.getItem(LANGUAGE_STORAGE_KEY);
}

i18next.init({
  // setInitialState sync-loads the cached non-en locale + calls
  // changeLanguage() before any UI renders. Starting at 'en' here means
  // even a cold-start user gets readable text before that swap happens.
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
  },
});

export const t = i18next.t.bind(i18next);
export default i18next;
