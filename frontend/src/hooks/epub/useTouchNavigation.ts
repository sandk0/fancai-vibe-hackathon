/**
 * useTouchNavigation - Edge tap navigation for EPUB reader
 *
 * - Tap left 25% = previous page
 * - Tap right 25% = next page
 * - Tap center 50% = do nothing (allow text selection)
 *
 * No swipe gestures - simplified for reliability and better text selection support.
 *
 * IMPORTANT: Touch coordinates from iframe are relative to iframe viewport,
 * so we must use iframe dimensions, not main window dimensions.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Rendition } from '@/types/epub';

const TAP_MAX_DURATION = 350; // ms
const TAP_MAX_MOVEMENT = 15; // px
const LEFT_ZONE_END = 0.25;
const RIGHT_ZONE_START = 0.75;

// Debug logging for mobile troubleshooting
const DEBUG = import.meta.env.DEV;
const log = DEBUG ? (...args: unknown[]) => console.log('[TouchNav]', ...args) : () => {};

interface UseTouchNavigationOptions {
  rendition: Rendition | null;
  nextPage: () => void;
  prevPage: () => void;
  enabled?: boolean;
}

export const useTouchNavigation = ({
  rendition,
  nextPage,
  prevPage,
  enabled = true,
}: UseTouchNavigationOptions): void => {
  const touchStartRef = useRef<{ x: number; y: number; time: number; screenWidth: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // Track if navigation happened to prevent epub.js default click behavior
  const navigationOccurredRef = useRef(false);
  // Store navigation functions in refs to avoid closure issues
  const nextPageRef = useRef(nextPage);
  const prevPageRef = useRef(prevPage);
  const enabledRef = useRef(enabled);

  // Keep refs updated
  useEffect(() => {
    nextPageRef.current = nextPage;
    prevPageRef.current = prevPage;
    enabledRef.current = enabled;
  }, [nextPage, prevPage, enabled]);

  // Determine if X coordinate is in edge zone (using provided screenWidth, not window.innerWidth)
  const isLeftEdge = useCallback((x: number, screenWidth: number) => {
    const threshold = screenWidth * LEFT_ZONE_END;
    const result = x < threshold;
    log('isLeftEdge:', { x, screenWidth, threshold, result });
    return result;
  }, []);

  const isRightEdge = useCallback((x: number, screenWidth: number) => {
    const threshold = screenWidth * RIGHT_ZONE_START;
    const result = x > threshold;
    log('isRightEdge:', { x, screenWidth, threshold, result });
    return result;
  }, []);

  // Use stable handlers that read from refs - prevents closure issues and duplicate handlers
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabledRef.current) return;

      const touch = e.touches[0];
      const x = touch.clientX;

      // Get iframe viewport width (touch coordinates are relative to iframe, not main window)
      const iframeWindow = (e.target as Element)?.ownerDocument?.defaultView;
      const screenWidth = iframeWindow?.innerWidth || window.innerWidth;

      log('touchstart:', { x, screenWidth, mainWindowWidth: window.innerWidth });

      // Reset navigation flag
      navigationOccurredRef.current = false;

      // If touch starts in edge zone, prevent text selection immediately
      if (isLeftEdge(x, screenWidth) || isRightEdge(x, screenWidth)) {
        e.preventDefault();
      }

      touchStartRef.current = {
        x,
        y: touch.clientY,
        time: Date.now(),
        screenWidth, // Store for use in touchend
      };
    },
    [isLeftEdge, isRightEdge] // Removed 'enabled' - using ref instead
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabledRef.current || !touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const endTime = Date.now();

      const startX = touchStartRef.current.x;
      const startY = touchStartRef.current.y;
      const startTime = touchStartRef.current.time;
      const screenWidth = touchStartRef.current.screenWidth;

      // Reset
      touchStartRef.current = null;

      // Calculate movement and duration
      const deltaX = Math.abs(endX - startX);
      const deltaY = Math.abs(endY - startY);
      const duration = endTime - startTime;

      log('touchend:', { startX, endX, deltaX, deltaY, duration, screenWidth });

      // Check if it's a tap (quick, minimal movement)
      const isTap =
        duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

      if (!isTap) {
        log('Not a tap - movement or duration too large');
        return;
      }

      // Check if tap is on a description highlight - let it handle the click
      const target = e.target as HTMLElement;
      if (target?.classList?.contains('description-highlight') || target?.closest('.description-highlight')) {
        log('Tap on description highlight - ignoring');
        return;
      }

      // Handle edge tap navigation - use refs to get current functions
      if (isLeftEdge(startX, screenWidth)) {
        log('LEFT EDGE TAP - navigating to previous page');
        e.preventDefault();
        e.stopPropagation();
        navigationOccurredRef.current = true;
        prevPageRef.current();
      } else if (isRightEdge(startX, screenWidth)) {
        log('RIGHT EDGE TAP - navigating to next page');
        e.preventDefault();
        e.stopPropagation();
        navigationOccurredRef.current = true;
        nextPageRef.current();
      } else {
        log('CENTER TAP - no navigation');
      }
    },
    [isLeftEdge, isRightEdge] // Removed nextPage, prevPage, enabled - using refs
  );

  /**
   * Click handler to prevent epub.js default click-to-navigate behavior
   * epub.js may have built-in click handlers that navigate on any click
   * We need to intercept these to maintain our edge-tap navigation
   */
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!enabledRef.current) return;

      // If our touch handler already navigated, prevent duplicate navigation
      if (navigationOccurredRef.current) {
        log('Click blocked - navigation already occurred via touch');
        e.preventDefault();
        e.stopPropagation();
        navigationOccurredRef.current = false;
        return;
      }

      // Get iframe dimensions
      const iframeWindow = (e.target as Element)?.ownerDocument?.defaultView;
      const screenWidth = iframeWindow?.innerWidth || window.innerWidth;
      const x = e.clientX;

      log('click:', { x, screenWidth });

      // Check if click is on a description highlight - let it through
      const target = e.target as HTMLElement;
      if (target?.classList?.contains('description-highlight') || target?.closest('.description-highlight')) {
        log('Click on description highlight - allowing');
        return;
      }

      // For ALL clicks in the iframe, prevent default and stop propagation
      // This prevents epub.js from doing any unwanted navigation
      // Our touch handlers already handle navigation
      e.preventDefault();
      e.stopPropagation();
      log('Click blocked - all iframe clicks prevented to avoid unwanted navigation');
    },
    [] // No dependencies - uses refs
  );

  useEffect(() => {
    if (!rendition) return;

    log('Setting up touch navigation effect');

    const setupListeners = () => {
      // Cleanup previous listeners first
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      try {
        const contents = rendition.getContents();
        if (!contents || contents.length === 0) {
          log('No contents available, skipping listener setup');
          return;
        }

        const doc = contents[0]?.document;
        if (!doc) {
          log('No document available, skipping listener setup');
          return;
        }

        log('Adding touch and click listeners to iframe document');

        // These handlers are stable (use refs internally), so same reference is used for add/remove
        doc.addEventListener('touchstart', handleTouchStart, { passive: false });
        doc.addEventListener('touchend', handleTouchEnd, { passive: false });
        // Click handler in capture phase to intercept before other handlers
        doc.addEventListener('click', handleClick, { capture: true });

        // Store cleanup function - handlers are stable so same refs work
        cleanupRef.current = () => {
          log('Removing touch and click listeners from iframe document');
          doc.removeEventListener('touchstart', handleTouchStart);
          doc.removeEventListener('touchend', handleTouchEnd);
          doc.removeEventListener('click', handleClick, { capture: true });
        };
      } catch (err) {
        log('Error setting up listeners:', err);
      }
    };

    // Setup on rendered event (fires when chapter changes)
    const handleRendered = () => {
      log('Rendered event fired, setting up listeners after delay');
      // Small delay to ensure iframe document is ready
      setTimeout(setupListeners, 100);
    };

    rendition.on('rendered', handleRendered);

    // Initial setup
    setupListeners();

    return () => {
      log('Cleaning up touch navigation effect');
      rendition.off('rendered', handleRendered);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [rendition, handleTouchStart, handleTouchEnd, handleClick]); // enabled is checked via ref
};
