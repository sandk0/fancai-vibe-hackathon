/**
 * useTheme - Global theme management hook
 *
 * Manages application-wide theme (light/dark/sepia/system) with localStorage persistence.
 * Supports system preference detection and automatic switching.
 *
 * @returns {object} Theme state and controls
 */

import { useState, useEffect, useCallback } from 'react';

export type AppTheme = 'light' | 'dark' | 'sepia' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'sepia';

const STORAGE_KEY = 'app-theme';

/**
 * Get system preferred theme
 */
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Resolve theme preference to actual theme
 */
const resolveTheme = (theme: AppTheme): ResolvedTheme => {
  if (theme === 'system') return getSystemTheme();
  return theme;
};

export const useTheme = () => {
  // User's preference (can be 'system')
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(STORAGE_KEY) as AppTheme | null;
    return saved || 'system';
  });

  // Actual applied theme (never 'system')
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(theme)
  );

  /**
   * Apply theme to document
   */
  const applyTheme = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement;

    // Remove all theme classes
    root.classList.remove('light', 'dark', 'sepia');

    // Add current theme class (light is default, no class needed but we add for consistency)
    root.classList.add(resolved);

    // Set color-scheme for native elements (scrollbars, inputs, etc.)
    root.style.colorScheme = resolved === 'dark' ? 'dark' : 'light';

    console.log('[useTheme] Theme applied:', resolved);
  }, []);

  /**
   * Set theme preference
   */
  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);

    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    console.log('[useTheme] Theme changed:', { preference: newTheme, resolved });
  }, [applyTheme]);

  // Initial setup and system theme listener
  useEffect(() => {
    // Apply initial theme
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyTheme(newResolved);
        console.log('[useTheme] System theme changed:', newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, [theme, applyTheme]);

  return {
    theme,           // User's preference: 'light' | 'dark' | 'sepia' | 'system'
    resolvedTheme,   // Actual applied theme: 'light' | 'dark' | 'sepia'
    setTheme,
    // Convenience flags (based on resolved theme)
    isDark: resolvedTheme === 'dark',
    isLight: resolvedTheme === 'light',
    isSepia: resolvedTheme === 'sepia',
    isSystem: theme === 'system',
  };
};
