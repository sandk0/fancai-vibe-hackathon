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

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

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
    [enabled, isLeftEdge, isRightEdge]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchStartRef.current) return;

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

      // Handle edge tap navigation
      if (isLeftEdge(startX, screenWidth)) {
        log('LEFT EDGE TAP - navigating to previous page');
        e.preventDefault();
        e.stopPropagation();
        navigationOccurredRef.current = true;
        prevPage();
      } else if (isRightEdge(startX, screenWidth)) {
        log('RIGHT EDGE TAP - navigating to next page');
        e.preventDefault();
        e.stopPropagation();
        navigationOccurredRef.current = true;
        nextPage();
      } else {
        log('CENTER TAP - no navigation');
      }
    },
    [enabled, nextPage, prevPage, isLeftEdge, isRightEdge]
  );

  /**
   * Click handler to prevent epub.js default click-to-navigate behavior
   * epub.js may have built-in click handlers that navigate on any click
   * We need to intercept these to maintain our edge-tap navigation
   */
  const handleClick = useCallback(
    (e: MouseEvent) => {
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

      // For center taps, prevent any default epub.js navigation
      const leftThreshold = screenWidth * LEFT_ZONE_END;
      const rightThreshold = screenWidth * RIGHT_ZONE_START;

      if (x >= leftThreshold && x <= rightThreshold) {
        // Center zone - prevent default navigation, allow text selection
        log('Click in center zone - preventing default navigation');
        // Don't preventDefault here as it might break text selection
        e.stopPropagation();
      }
    },
    []
  );

  useEffect(() => {
    if (!rendition || !enabled) return;

    const setupListeners = () => {
      // Cleanup previous listeners first
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      try {
        const contents = rendition.getContents();
        if (!contents || contents.length === 0) return;

        const doc = contents[0]?.document;
        if (!doc) return;

        log('Setting up touch and click listeners on iframe document');

        doc.addEventListener('touchstart', handleTouchStart, { passive: false });
        doc.addEventListener('touchend', handleTouchEnd, { passive: false });
        // Add click handler to prevent epub.js default navigation
        doc.addEventListener('click', handleClick, { capture: true });

        // Store cleanup function
        cleanupRef.current = () => {
          doc.removeEventListener('touchstart', handleTouchStart);
          doc.removeEventListener('touchend', handleTouchEnd);
          doc.removeEventListener('click', handleClick, { capture: true });
        };
      } catch (_err) {
        // Ignore errors - iframe may not be ready
      }
    };

    // Setup on rendered event (fires when chapter changes)
    const handleRendered = () => {
      // Small delay to ensure iframe document is ready
      setTimeout(setupListeners, 50);
    };

    rendition.on('rendered', handleRendered);

    // Initial setup
    setupListeners();

    return () => {
      rendition.off('rendered', handleRendered);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [rendition, enabled, handleTouchStart, handleTouchEnd, handleClick]);
};
