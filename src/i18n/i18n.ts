import i18next from 'i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import de from './locales/de.json';
import ar from './locales/ar.json';

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
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    es: { translation: es },
    'pt-BR': { translation: ptBR },
    de: { translation: de },
    ar: { translation: ar },
  },
});

export const t = i18next.t.bind(i18next);
export default i18next;
