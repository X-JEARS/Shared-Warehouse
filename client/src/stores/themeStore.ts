import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n, { getSystemLanguage, EffectiveLanguage } from '../locales/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';
export type StyleVariant = 'default' | 'rounded' | 'compact';
export type LanguageMode = 'zh-CN' | 'en-US' | 'system';

const THEME_COLORS: Record<EffectiveTheme, string> = {
  light: '#f5f5f5',
  dark: '#111111',
};

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(effectiveTheme: EffectiveTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.documentElement.style.colorScheme = effectiveTheme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute('content', THEME_COLORS[effectiveTheme]);

  const appleStatusBar = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  );
  appleStatusBar?.setAttribute('content', effectiveTheme === 'dark' ? 'black' : 'default');
}

function applyStyle(style: StyleVariant) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-style', style);
}

function applyLanguage(effectiveLanguage: EffectiveLanguage) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-language', effectiveLanguage);
  i18n.changeLanguage(effectiveLanguage);
}

interface ThemeState {
  theme: ThemeMode;
  effectiveTheme: EffectiveTheme;
  style: StyleVariant;
  language: LanguageMode;
  effectiveLanguage: EffectiveLanguage;
  setTheme: (theme: ThemeMode) => void;
  setStyle: (style: StyleVariant) => void;
  setLanguage: (language: LanguageMode) => void;
  _init: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      effectiveTheme: 'light',
      style: 'default',
      language: 'system',
      effectiveLanguage: getSystemLanguage(),

      setTheme: (theme: ThemeMode) => {
        const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(effectiveTheme);
        set({ theme, effectiveTheme });
      },

      setStyle: (style: StyleVariant) => {
        applyStyle(style);
        set({ style });
      },

      setLanguage: (language: LanguageMode) => {
        const effectiveLanguage = language === 'system' ? getSystemLanguage() : language;
        applyLanguage(effectiveLanguage);
        set({ language, effectiveLanguage });
      },

      _init: () => {
        const { theme, style, language } = get();
        const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
        const effectiveLanguage = language === 'system' ? getSystemLanguage() : language;
        applyTheme(effectiveTheme);
        applyStyle(style);
        applyLanguage(effectiveLanguage);
        set({ effectiveTheme, effectiveLanguage });

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const themeHandler = (e: MediaQueryListEvent) => {
          const current = get();
          if (current.theme === 'system') {
            const newEffective = e.matches ? 'dark' : 'light';
            applyTheme(newEffective);
            set({ effectiveTheme: newEffective });
          }
        };
        mediaQuery.addEventListener('change', themeHandler);

        // Listen for system language changes
        const languageHandler = () => {
          const current = get();
          if (current.language === 'system') {
            const newEffective = getSystemLanguage();
            if (newEffective !== current.effectiveLanguage) {
              applyLanguage(newEffective);
              set({ effectiveLanguage: newEffective });
            }
          }
        };
        window.addEventListener('languagechange', languageHandler);
      },
    }),
    {
      name: 'theme-storage',
      version: 1,
      partialize: (state) => ({ theme: state.theme, style: state.style, language: state.language }),
    }
  )
);
