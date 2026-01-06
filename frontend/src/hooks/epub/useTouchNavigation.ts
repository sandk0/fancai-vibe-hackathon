/**
 * useTouchNavigation - Touch/tap navigation for EPUB reader
 *
 * Uses epub.js built-in event passing - epub.js already proxies DOM events
 * (click, touchstart, touchend) from the iframe to the rendition.
 *
 * Tap zones:
 * - Left 25% = previous page
 * - Right 25% = next page
 * - Center 50% = allow text selection and description clicks
 *
 * ARCHITECTURE:
 * epub.js passEvents() in rendition.js automatically forwards DOM events
 * from the iframe content to the rendition. We just need to listen on
 * the rendition using rendition.on('click', ...), rendition.on('touchstart', ...), etc.
 *
 * FIXES:
 * 1. Prevent double navigation by ignoring click after touch
 * 2. Use window.innerWidth for zone calculation (iframe coords are relative)
 */

import { useEffect, useRef } from 'react';
import type { Rendition } from '@/types/epub';

const TAP_MAX_DURATION = 350; // ms - max duration to be considered a tap
const TAP_MAX_MOVEMENT = 20; // px - increased for mobile tolerance
const LEFT_ZONE_END = 0.25;
const RIGHT_ZONE_START = 0.75;

// Debounce time to prevent click after touch
const TOUCH_CLICK_DEBOUNCE = 500; // ms

// Debug logging - enabled to diagnose issues
const log = (...args: unknown[]) => console.log('[TouchNav]', ...args);

interface UseTouchNavigationOptions {
  rendition: Rendition | null;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  nextPage: () => void;
  prevPage: () => void;
  enabled?: boolean;
}

export const useTouchNavigation = ({
  rendition,
  viewerRef: _viewerRef, // Not used in this approach
  nextPage,
  prevPage,
  enabled = true,
}: UseTouchNavigationOptions): void => {
  // Store navigation functions in refs to avoid closure issues
  const nextPageRef = useRef(nextPage);
  const prevPageRef = useRef(prevPage);
  const enabledRef = useRef(enabled);

  // Track touch start for tap detection
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Track last touch navigation time to prevent click after touch
  const lastTouchNavTimeRef = useRef<number>(0);

  // Keep refs updated
  useEffect(() => {
    nextPageRef.current = nextPage;
    prevPageRef.current = prevPage;
    enabledRef.current = enabled;
  }, [nextPage, prevPage, enabled]);

  /**
   * Main effect - setup event listeners on rendition
   * epub.js passEvents() already forwards DOM events from iframe to rendition
   */
  useEffect(() => {
    if (!rendition) {
      log('No rendition, skipping setup');
      return;
    }

    log('Setting up touch navigation via rendition events');

    /**
     * Get the actual screen X coordinate
     * epub.js events come from iframe, so we need to account for iframe position
     */
    const getScreenX = (clientX: number): number => {
      // The iframe is typically full-width, but let's get the actual position
      // For safety, we'll use the clientX directly since epub.js iframe is usually full-width
      // But we need to get the iframe's position to adjust
      try {
        const contents = rendition.getContents();
        if (contents && contents.length > 0) {
          const iframe = contents[0];
          // Get iframe's bounding rect via the window
          const iframeWindow = iframe.window;
          if (iframeWindow && iframeWindow.frameElement) {
            const rect = (iframeWindow.frameElement as HTMLElement).getBoundingClientRect();
            // Add iframe's left offset to get screen X
            return clientX + rect.left;
          }
        }
      } catch (e) {
        log('Error getting iframe position:', e);
      }
      // Fallback - assume iframe starts at x=0
      return clientX;
    };

    /**
     * Determine navigation action based on X coordinate relative to window width
     */
    const getNavigationAction = (screenX: number): 'prev' | 'next' | 'none' => {
      const screenWidth = window.innerWidth;
      const leftThreshold = screenWidth * LEFT_ZONE_END;
      const rightThreshold = screenWidth * RIGHT_ZONE_START;

      log('Zone check:', { screenX, screenWidth, leftThreshold, rightThreshold });

      if (screenX < leftThreshold) return 'prev';
      if (screenX > rightThreshold) return 'next';
      return 'none';
    };

    /**
     * Check if target is a description highlight
     */
    const isDescriptionHighlight = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return target.classList?.contains('description-highlight') ||
             !!target.closest?.('.description-highlight');
    };

    /**
     * Handle touch start - record position and time
     */
    const handleTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      // Get screen X coordinate (accounting for iframe position)
      const screenX = getScreenX(touch.clientX);
      const y = touch.clientY;

      log('TouchStart:', { clientX: touch.clientX, screenX, y });

      touchStartRef.current = {
        x: screenX,
        y,
        time: Date.now(),
      };
    };

    /**
     * Handle touch end - determine if it was a tap and navigate
     */
    const handleTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current) return;

      if (!touchStartRef.current) {
        log('TouchEnd: No touchStart recorded');
        return;
      }

      const touch = e.changedTouches[0];
      if (!touch) {
        touchStartRef.current = null;
        return;
      }

      const endScreenX = getScreenX(touch.clientX);
      const endY = touch.clientY;
      const endTime = Date.now();

      const startX = touchStartRef.current.x;
      const startY = touchStartRef.current.y;
      const startTime = touchStartRef.current.time;

      // Reset
      touchStartRef.current = null;

      // Calculate movement and duration
      const deltaX = Math.abs(endScreenX - startX);
      const deltaY = Math.abs(endY - startY);
      const duration = endTime - startTime;

      const isTap = duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

      log('TouchEnd:', { startX, endScreenX, deltaX, deltaY, duration, isTap });

      if (!isTap) {
        log('Not a tap - ignoring (swipe or long press)');
        return;
      }

      // Check if tap is on description highlight - allow through
      if (isDescriptionHighlight(e.target)) {
        log('Tap on description highlight - allowing through');
        return;
      }

      // Handle navigation based on zone (use start position for tap)
      const action = getNavigationAction(startX);
      log('Touch navigation action:', action);

      if (action === 'prev') {
        log('LEFT ZONE TAP - calling prevPage()');
        lastTouchNavTimeRef.current = Date.now();
        prevPageRef.current();
      } else if (action === 'next') {
        log('RIGHT ZONE TAP - calling nextPage()');
        lastTouchNavTimeRef.current = Date.now();
        nextPageRef.current();
      } else {
        log('CENTER ZONE TAP - no navigation');
      }
    };

    /**
     * Handle click - for desktop navigation
     * On mobile, click fires AFTER touchend - we need to ignore it
     */
    const handleClick = (e: MouseEvent) => {
      if (!enabledRef.current) return;

      // CRITICAL: Ignore click if it came shortly after a touch navigation
      // This prevents double page turns on mobile
      const timeSinceTouch = Date.now() - lastTouchNavTimeRef.current;
      if (timeSinceTouch < TOUCH_CLICK_DEBOUNCE) {
        log('Click ignored - too soon after touch navigation:', timeSinceTouch, 'ms');
        return;
      }

      // Get screen X coordinate
      const screenX = getScreenX(e.clientX);
      log('Click:', { clientX: e.clientX, screenX, target: (e.target as HTMLElement)?.tagName });

      // Check if click is on description highlight - allow through
      if (isDescriptionHighlight(e.target)) {
        log('Click on description highlight - allowing through');
        return;
      }

      // Handle navigation based on zone
      const action = getNavigationAction(screenX);
      log('Click action:', action);

      if (action === 'prev') {
        log('LEFT ZONE CLICK - calling prevPage()');
        prevPageRef.current();
      } else if (action === 'next') {
        log('RIGHT ZONE CLICK - calling nextPage()');
        nextPageRef.current();
      } else {
        log('CENTER ZONE CLICK - no navigation');
      }
    };

    // Register event handlers on rendition
    // epub.js passEvents() forwards these from the iframe content
    log('Registering event handlers on rendition');

    rendition.on('touchstart', handleTouchStart as unknown as (...args: unknown[]) => void);
    rendition.on('touchend', handleTouchEnd as unknown as (...args: unknown[]) => void);
    rendition.on('click', handleClick as unknown as (...args: unknown[]) => void);

    log('Event handlers registered');

    // Cleanup
    return () => {
      log('Cleaning up touch navigation');
      rendition.off('touchstart', handleTouchStart as unknown as (...args: unknown[]) => void);
      rendition.off('touchend', handleTouchEnd as unknown as (...args: unknown[]) => void);
      rendition.off('click', handleClick as unknown as (...args: unknown[]) => void);
    };
  }, [rendition]);
};
