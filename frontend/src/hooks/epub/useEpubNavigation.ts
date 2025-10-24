/**
 * useEpubNavigation - Custom hook for EPUB page navigation
 *
 * Provides simple next/prev page navigation with keyboard support.
 *
 * @param rendition - epub.js Rendition instance
 * @returns Navigation functions
 *
 * @example
 * const { nextPage, prevPage, canGoNext, canGoPrev } = useEpubNavigation(rendition);
 */

import { useCallback } from 'react';
import type { Rendition } from 'epubjs';

interface UseEpubNavigationReturn {
  nextPage: () => void;
  prevPage: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export const useEpubNavigation = (
  rendition: Rendition | null
): UseEpubNavigationReturn => {

  const nextPage = useCallback(() => {
    if (!rendition) return;

    console.log('➡️ [useEpubNavigation] Next page');
    rendition.next();
  }, [rendition]);

  const prevPage = useCallback(() => {
    if (!rendition) return;

    console.log('⬅️ [useEpubNavigation] Previous page');
    rendition.prev();
  }, [rendition]);

  // Note: epub.js doesn't provide easy way to check if we can go next/prev
  // We return true for now, and let epub.js handle boundaries
  const canGoNext = !!rendition;
  const canGoPrev = !!rendition;

  return {
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev,
  };
};

/**
 * useKeyboardNavigation - Keyboard shortcuts for EPUB navigation
 *
 * @param nextPage - Function to go to next page
 * @param prevPage - Function to go to previous page
 * @param enabled - Whether keyboard navigation is enabled
 *
 * @example
 * useKeyboardNavigation(nextPage, prevPage, true);
 */
export const useKeyboardNavigation = (
  nextPage: () => void,
  prevPage: () => void,
  enabled: boolean = true
): void => {
  useCallback(() => {
    if (!enabled) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ': // Spacebar
          e.preventDefault();
          nextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [nextPage, prevPage, enabled]);
};
