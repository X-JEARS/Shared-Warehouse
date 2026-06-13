import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './zh-CN.json';
import enUS from './en-US.json';

export type EffectiveLanguage = 'zh-CN' | 'en-US';

function getSystemLanguage(): EffectiveLanguage {
  if (typeof navigator === 'undefined') return 'zh-CN';
  const lang = navigator.language || (navigator as any).userLanguage;
  if (lang.startsWith('zh')) return 'zh-CN';
  return 'en-US';
}

// Get saved language or default to system language
const savedLanguage = localStorage.getItem('language-storage');
let initialLanguage = 'zh-CN';
try {
  if (savedLanguage) {
    const parsed = JSON.parse(savedLanguage);
    const lang = parsed?.state?.language;
    if (lang === 'system') {
      initialLanguage = getSystemLanguage();
    } else if (lang) {
      initialLanguage = lang;
    } else {
      initialLanguage = getSystemLanguage();
    }
  } else {
    initialLanguage = getSystemLanguage();
  }
} catch {
  initialLanguage = getSystemLanguage();
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    lng: initialLanguage,
    fallbackLng: 'zh-CN',
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export { getSystemLanguage };
export default i18n;
