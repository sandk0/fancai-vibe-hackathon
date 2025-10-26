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
import type { Rendition } from 'epubjs';

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

const THEME_STORAGE_KEY = 'epub_reader_theme';
const FONT_SIZE_STORAGE_KEY = 'epub_reader_font_size';

const DEFAULT_THEME: ThemeName = 'dark';
const DEFAULT_FONT_SIZE = 100; // percentage
const MIN_FONT_SIZE = 75;
const MAX_FONT_SIZE = 200;
const FONT_SIZE_STEP = 10;

/**
 * Theme definitions
 */
const THEMES: Record<ThemeName, ThemeStyles> = {
  light: {
    body: {
      color: '#1f2937',
      background: '#ffffff',
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    p: {
      'margin-bottom': '1em',
    },
    a: {
      color: '#2563eb',
    },
    h1: {
      color: '#111827',
    },
    h2: {
      color: '#111827',
    },
    h3: {
      color: '#111827',
    },
  },
  dark: {
    body: {
      color: '#e5e7eb',
      background: '#1f2937',
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    p: {
      'margin-bottom': '1em',
    },
    a: {
      color: '#60a5fa',
    },
    h1: {
      color: '#f3f4f6',
    },
    h2: {
      color: '#f3f4f6',
    },
    h3: {
      color: '#f3f4f6',
    },
  },
  sepia: {
    body: {
      color: '#5c4a3c',
      background: '#f4ecd8',
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    p: {
      'margin-bottom': '1em',
    },
    a: {
      color: '#8b5a2b',
    },
    h1: {
      color: '#3d2f24',
    },
    h2: {
      color: '#3d2f24',
    },
    h3: {
      color: '#3d2f24',
    },
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
