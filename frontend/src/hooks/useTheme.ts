/**
 * useTheme - Global theme management hook
 *
 * Manages application-wide theme (light/dark/sepia) with localStorage persistence.
 * Applies theme to document root for global styling.
 *
 * @returns {object} Theme state and controls
 */

import { useState, useEffect } from 'react';

export type AppTheme = 'light' | 'dark' | 'sepia';

const STORAGE_KEY = 'app-theme';

export const useTheme = () => {
  const [theme, setTheme] = useState<AppTheme>(() => {
    // Initialize from localStorage or default to 'light'
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as AppTheme) || 'light';
  });

  useEffect(() => {
    // Apply theme to document root
    document.documentElement.classList.remove('light', 'dark', 'sepia');
    document.documentElement.classList.add(theme);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, theme);

    console.log('🎨 [useTheme] Theme changed:', theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    isSepia: theme === 'sepia',
  };
};
