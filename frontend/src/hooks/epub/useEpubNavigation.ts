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
   * iOS FIX: Direct scroll navigation bypassing epub.js
   * epub.js navigation is broken on iOS PWA - scrolls multiple pages
   * We directly manipulate the scroll position instead
   */
  const iosDirectScroll = useCallback((direction: 'next' | 'prev'): boolean => {
    if (!rendition) return false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const manager = (rendition as any).manager;
      if (!manager) return false;

      // Get the stage/container element that scrolls
      const stage = manager.stage?.container || manager.container;
      if (!stage) return false;

      const viewportWidth = stage.clientWidth;
      const currentScroll = stage.scrollLeft;
      const maxScroll = stage.scrollWidth - viewportWidth;

      let newScroll: number;
      if (direction === 'next') {
        newScroll = Math.min(currentScroll + viewportWidth, maxScroll);
      } else {
        newScroll = Math.max(currentScroll - viewportWidth, 0);
      }

      // Check if we can scroll (not at boundary)
      if (direction === 'next' && currentScroll >= maxScroll) {
        // At end - let epub.js handle chapter change
        debugInfoRef.current = `END S:${Math.round(currentScroll)}`;
        return false;
      }
      if (direction === 'prev' && currentScroll <= 0) {
        // At start - let epub.js handle chapter change
        debugInfoRef.current = `START S:${Math.round(currentScroll)}`;
        return false;
      }

      // Perform direct scroll
      stage.scrollLeft = newScroll;
      debugInfoRef.current = `S:${Math.round(currentScroll)}→${Math.round(newScroll)} W:${viewportWidth}`;

      return true;
    } catch (err) {
      console.warn('[useEpubNavigation] iOS direct scroll error:', err);
      return false;
    }
  }, [rendition]);

  const nextPage = useCallback(async () => {
    if (!rendition) return;

    // On iOS, try direct scroll first
    if (isIOS()) {
      const scrolled = iosDirectScroll('next');
      if (scrolled) return; // Direct scroll worked
      // Fall through to epub.js for chapter changes
    }

    try {
      await rendition.next();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useEpubNavigation] Could not go to next page:', err);
      }
    }
  }, [rendition, iosDirectScroll]);

  const prevPage = useCallback(async () => {
    if (!rendition) return;

    // On iOS, try direct scroll first
    if (isIOS()) {
      const scrolled = iosDirectScroll('prev');
      if (scrolled) return; // Direct scroll worked
      // Fall through to epub.js for chapter changes
    }

    try {
      await rendition.prev();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useEpubNavigation] Could not go to prev page:', err);
      }
    }
  }, [rendition, iosDirectScroll]);

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
