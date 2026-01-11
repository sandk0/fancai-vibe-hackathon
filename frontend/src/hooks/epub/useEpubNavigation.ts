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

import { useCallback, useEffect, useRef } from 'react';
import type { Rendition } from '@/types/epub';

// Detect iOS device
const isIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIOSDevice || isIPadOS;
};

interface UseEpubNavigationReturn {
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  canGoNext: boolean;
  canGoPrev: boolean;
  debugInfo: string | null;
}

export const useEpubNavigation = (
  rendition: Rendition | null
): UseEpubNavigationReturn => {
  const debugInfoRef = useRef<string | null>(null);

  /**
   * iOS FIX: Force correct delta before navigation
   * epub.js may calculate wrong delta based on incorrect column width
   */
  const fixIOSLayoutBeforeNav = useCallback(() => {
    if (!rendition || !isIOS()) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manager = (rendition as any).manager;
      if (!manager?.layout) return;

      const layout = manager.layout;
      const container = manager.container;

      if (!container) return;

      // Get actual viewport width
      const viewportWidth = container.clientWidth;

      // Force divisor to 1
      if (layout.divisor !== 1) {
        layout.divisor = 1;
      }

      // Force delta to be exactly viewport width
      // delta is the scroll amount per navigation
      const correctDelta = viewportWidth;
      if (layout.delta !== correctDelta) {
        const oldDelta = layout.delta;
        layout.delta = correctDelta;
        debugInfoRef.current = `D:${oldDelta}→${correctDelta} W:${viewportWidth}`;
      } else {
        debugInfoRef.current = `D:${layout.delta} W:${viewportWidth} div:${layout.divisor}`;
      }
    } catch (err) {
      console.warn('[useEpubNavigation] Error fixing iOS layout:', err);
    }
  }, [rendition]);

  const nextPage = useCallback(async () => {
    if (!rendition) return;

    // Fix layout before navigation on iOS
    fixIOSLayoutBeforeNav();

    try {
      await rendition.next();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useEpubNavigation] Could not go to next page:', err);
      }
    }
  }, [rendition, fixIOSLayoutBeforeNav]);

  const prevPage = useCallback(async () => {
    if (!rendition) return;

    // Fix layout before navigation on iOS
    fixIOSLayoutBeforeNav();

    try {
      await rendition.prev();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useEpubNavigation] Could not go to prev page:', err);
      }
    }
  }, [rendition, fixIOSLayoutBeforeNav]);

  // Note: epub.js doesn't provide easy way to check if we can go next/prev
  // We return true for now, and let epub.js handle boundaries
  const canGoNext = !!rendition;
  const canGoPrev = !!rendition;

  return {
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev,
    debugInfo: debugInfoRef.current,
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
