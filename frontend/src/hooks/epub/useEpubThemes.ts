/**
 * useEpubThemes - Custom hook for managing EPUB themes
 *
 * Provides theme switching functionality (light/dark/sepia) and font size control.
 *
 * @param rendition - epub.js Rendition instance
 * @returns Theme state and control functions
 *
 * @example
 * const { theme, fontSize, setTheme, setFontSize } = useEpubThemes(rendition);
 * setTheme('dark');
 * setFontSize(120);
 */

import { useState, useEffect, useCallback } from 'react';
import type { Rendition } from '@/types/epub';

export type ThemeName = 'light' | 'dark' | 'sepia';

interface ThemeStyles {
  body: Record<string, string>;
  p?: Record<string, string>;
  a?: Record<string, string>;
  h1?: Record<string, string>;
  h2?: Record<string, string>;
  h3?: Record<string, string>;
}

interface UseEpubThemesReturn {
  theme: ThemeName;
  fontSize: number;
  setTheme: (theme: ThemeName) => void;
  setFontSize: (size: number) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

/**
 * NOTE: This hook shares the same localStorage key as useTheme.ts
 * This ensures EPUB reader theme stays in sync with app theme.
 * The 'system' preference from useTheme is resolved to 'light' or 'dark' before reaching here.
 */
const THEME_STORAGE_KEY = 'app-theme'; // Sync with useTheme.ts
const FONT_SIZE_STORAGE_KEY = 'epub_reader_font_size';

const DEFAULT_THEME: ThemeName = 'light';
const DEFAULT_FONT_SIZE = 100; // percentage
const MIN_FONT_SIZE = 75;
const MAX_FONT_SIZE = 200;
const FONT_SIZE_STEP = 10;

/**
 * Theme definitions - colors match globals.css CSS variables
 */
const THEMES: Record<ThemeName, ThemeStyles> = {
  light: {
    body: {
      color: 'hsl(222.2, 84%, 4.9%)', // --foreground
      background: 'hsl(0, 0%, 100%)', // --background
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    p: {
      'margin-bottom': '1em',
    },
    a: {
      color: 'hsl(221.2, 83.2%, 53.3%)', // --primary
    },
    h1: { color: 'hsl(222.2, 84%, 4.9%)' },
    h2: { color: 'hsl(222.2, 84%, 4.9%)' },
    h3: { color: 'hsl(222.2, 84%, 4.9%)' },
  },
  dark: {
    body: {
      color: 'hsl(210, 40%, 98%)', // --foreground (dark)
      background: 'hsl(222.2, 84%, 4.9%)', // --background (dark)
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    p: {
      'margin-bottom': '1em',
    },
    a: {
      color: 'hsl(217.2, 91.2%, 59.8%)', // --primary (dark)
    },
    h1: { color: 'hsl(210, 40%, 98%)' },
    h2: { color: 'hsl(210, 40%, 98%)' },
    h3: { color: 'hsl(210, 40%, 98%)' },
  },
  sepia: {
    body: {
      color: 'hsl(18, 28%, 29%)', // --foreground (sepia)
      background: 'hsl(39, 39%, 94%)', // --background (sepia)
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    p: {
      'margin-bottom': '1em',
    },
    a: {
      color: 'hsl(28, 79%, 45%)', // --primary (sepia)
    },
    h1: { color: 'hsl(18, 28%, 29%)' },
    h2: { color: 'hsl(18, 28%, 29%)' },
    h3: { color: 'hsl(18, 28%, 29%)' },
  },
};

export const useEpubThemes = (
  rendition: Rendition | null
): UseEpubThemesReturn => {
  // Load theme from localStorage or use default
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved as ThemeName) || DEFAULT_THEME;
  });

  // Load font size from localStorage or use default
  const [fontSize, setFontSizeState] = useState<number>(() => {
    const saved = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_FONT_SIZE;
  });

  /**
   * Apply theme to rendition
   */
  const applyTheme = useCallback((themeName: ThemeName, size: number) => {
    if (!rendition) return;

    try {
      const themeStyles = THEMES[themeName];
      const fontSizeMultiplier = size / 100;

      // Apply base theme styles
      const styledTheme = {
        ...themeStyles,
        body: {
          ...themeStyles.body,
          'font-size': `${fontSizeMultiplier}em`,
        },
      };

      rendition.themes.default(styledTheme);

      console.log('🎨 [useEpubThemes] Theme applied:', {
        theme: themeName,
        fontSize: size + '%',
      });
    } catch (err) {
      console.error('❌ [useEpubThemes] Error applying theme:', err);
    }
  }, [rendition]);

  /**
   * Change theme
   */
  const setTheme = useCallback((newTheme: ThemeName) => {
    console.log('🎨 [useEpubThemes] Changing theme to:', newTheme);
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    applyTheme(newTheme, fontSize);
  }, [fontSize, applyTheme]);

  /**
   * Change font size
   */
  const setFontSize = useCallback((newSize: number) => {
    const clampedSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, newSize));
    console.log('📝 [useEpubThemes] Changing font size to:', clampedSize + '%');
    setFontSizeState(clampedSize);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, clampedSize.toString());
    applyTheme(theme, clampedSize);
  }, [theme, applyTheme]);

  /**
   * Increase font size
   */
  const increaseFontSize = useCallback(() => {
    setFontSize(fontSize + FONT_SIZE_STEP);
  }, [fontSize, setFontSize]);

  /**
   * Decrease font size
   */
  const decreaseFontSize = useCallback(() => {
    setFontSize(fontSize - FONT_SIZE_STEP);
  }, [fontSize, setFontSize]);

  /**
   * Apply theme when rendition is ready
   */
  useEffect(() => {
    if (rendition) {
      applyTheme(theme, fontSize);
    }
  }, [rendition, theme, fontSize, applyTheme]);

  return {
    theme,
    fontSize,
    setTheme,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
  };
};
