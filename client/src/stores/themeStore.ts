import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';
export type StyleVariant = 'default' | 'rounded' | 'compact';

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(effectiveTheme: EffectiveTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

function applyStyle(style: StyleVariant) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-style', style);
}

interface ThemeState {
  theme: ThemeMode;
  effectiveTheme: EffectiveTheme;
  style: StyleVariant;
  setTheme: (theme: ThemeMode) => void;
  setStyle: (style: StyleVariant) => void;
  _init: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      effectiveTheme: 'light',
      style: 'default',

      setTheme: (theme: ThemeMode) => {
        const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(effectiveTheme);
        set({ theme, effectiveTheme });
      },

      setStyle: (style: StyleVariant) => {
        applyStyle(style);
        set({ style });
      },

      _init: () => {
        const { theme, style } = get();
        const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(effectiveTheme);
        applyStyle(style);
        set({ effectiveTheme });

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => {
          const current = get();
          if (current.theme === 'system') {
            const newEffective = e.matches ? 'dark' : 'light';
            applyTheme(newEffective);
            set({ effectiveTheme: newEffective });
          }
        };
        mediaQuery.addEventListener('change', handler);
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ theme: state.theme, style: state.style }),
    }
  )
);