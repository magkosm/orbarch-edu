import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from './locales/en/translation.json';
import translationSV from './locales/sv/translation.json';
import translationEL from './locales/el/translation.json';

// Resources object with translations
const resources = {
  en: {
    translation: translationEN
  },
  sv: {
    translation: translationSV
  },
  el: {
    translation: translationEL
  }
};

i18n
  // detect user language
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next
  .use(initReactI18next)
  // init i18next
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    
    // Language detection options
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
    }
  });

// Keep <html lang> in sync with the active language so the browser applies
// locale-aware typography (e.g. Greek uppercase accents), hyphenation and
// assistive-technology pronunciation. `init` resolves asynchronously, so the
// 'languageChanged' listener also covers the initial detection.
const syncHtmlLang = (lng) => {
  if (typeof document === 'undefined' || !lng) return;
  document.documentElement.lang = lng.split('-')[0];
};
i18n.on('languageChanged', syncHtmlLang);
syncHtmlLang(i18n.language);

export default i18n; 