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

import { useCallback, useEffect } from 'react';
import type { Rendition } from '@/types/epub';

interface UseEpubNavigationReturn {
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export const useEpubNavigation = (
  rendition: Rendition | null
): UseEpubNavigationReturn => {

  const nextPage = useCallback(async () => {
    if (!rendition) return;
    try {
      await rendition.next();
    } catch (err) {
      // Silent fail is OK - usually means end of book
      if (import.meta.env.DEV) {
        console.warn('[useEpubNavigation] Could not go to next page:', err);
      }
    }
  }, [rendition]);

  const prevPage = useCallback(async () => {
    if (!rendition) return;
    try {
      await rendition.prev();
    } catch (err) {
      // Silent fail is OK - usually means beginning of book
      if (import.meta.env.DEV) {
        console.warn('[useEpubNavigation] Could not go to prev page:', err);
      }
    }
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
 * Listens on both the main window and the epub.js iframe document
 * to ensure keyboard events work when focus is inside the reader.
 *
 * @param nextPage - Function to go to next page
 * @param prevPage - Function to go to previous page
 * @param enabled - Whether keyboard navigation is enabled
 * @param rendition - Optional epub.js Rendition for iframe keyboard events
 *
 * @example
 * useKeyboardNavigation(nextPage, prevPage, true, rendition);
 */
export const useKeyboardNavigation = (
  nextPage: () => void,
  prevPage: () => void,
  enabled: boolean = true,
  rendition?: Rendition | null
): void => {
  useEffect(() => {
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

    // Listen on main window
    window.addEventListener('keydown', handleKeyPress);

    // Also listen in epub.js iframe for when focus is inside
    const attachToIframe = () => {
      const contents = rendition?.getContents();
      if (contents && contents[0]?.document) {
        contents[0].document.addEventListener('keydown', handleKeyPress);
      }
    };

    // Attach on rendered event (iframe may reload on chapter change)
    rendition?.on('rendered', attachToIframe);

    // Attach immediately if already rendered
    attachToIframe();

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      rendition?.off('rendered', attachToIframe);
      // Clean up iframe listener
      const contents = rendition?.getContents();
      if (contents && contents[0]?.document) {
        contents[0].document.removeEventListener('keydown', handleKeyPress);
      }
    };
  }, [nextPage, prevPage, enabled, rendition]);
};
