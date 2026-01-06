/**
 * useTouchNavigation - Edge tap navigation for EPUB reader
 *
 * - Tap left 25% = previous page
 * - Tap right 25% = next page
 * - Tap center 50% = do nothing (allow text selection and description clicks)
 *
 * ARCHITECTURE:
 * We add handlers directly to the viewerRef element (the container we control).
 * This intercepts all touch/click events before they reach epub.js.
 */

import { useEffect, useRef, RefObject } from 'react';
import type { Rendition } from '@/types/epub';

const TAP_MAX_DURATION = 350; // ms - max duration to be considered a tap
const TAP_MAX_MOVEMENT = 20; // px - increased for mobile tolerance
const LEFT_ZONE_END = 0.25;
const RIGHT_ZONE_START = 0.75;

// Debug logging - ALWAYS ON for now to diagnose mobile issues
const log = (...args: unknown[]) => console.log('[TouchNav]', ...args);

interface UseTouchNavigationOptions {
  rendition: Rendition | null;
  viewerRef: RefObject<HTMLDivElement | null>;
  nextPage: () => void;
  prevPage: () => void;
  enabled?: boolean;
}

export const useTouchNavigation = ({
  rendition,
  viewerRef,
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

  // Keep refs updated
  useEffect(() => {
    nextPageRef.current = nextPage;
    prevPageRef.current = prevPage;
    enabledRef.current = enabled;
  }, [nextPage, prevPage, enabled]);

  /**
   * Main effect - setup handlers on viewerRef
   */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      log('ERROR: viewerRef is null');
      return;
    }

    log('Setting up touch navigation on viewer element');

    // Use the main window width for zone calculations
    const getScreenWidth = () => window.innerWidth;

    /**
     * Determine navigation action based on X coordinate
     */
    const getNavigationAction = (x: number): 'prev' | 'next' | 'none' => {
      const screenWidth = getScreenWidth();
      const leftThreshold = screenWidth * LEFT_ZONE_END;
      const rightThreshold = screenWidth * RIGHT_ZONE_START;

      log('Zone check:', { x, screenWidth, leftThreshold, rightThreshold });

      if (x < leftThreshold) return 'prev';
      if (x > rightThreshold) return 'next';
      return 'none';
    };

    /**
     * Check if target is a description highlight (inside iframe)
     */
    const isDescriptionHighlight = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      return target.classList?.contains('description-highlight') ||
             !!target.closest?.('.description-highlight');
    };

    // ===== TOUCH HANDLERS =====

    const handleTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;

      const touch = e.touches[0];
      const x = touch.clientX;

      log('TouchStart:', { x, y: touch.clientY });

      touchStartRef.current = {
        x,
        y: touch.clientY,
        time: Date.now(),
      };

      // Check zone - if edge zone, prevent default to block text selection
      const action = getNavigationAction(x);
      if (action !== 'none') {
        log('Edge zone touch - preventing default');
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current) return;

      if (!touchStartRef.current) {
        log('TouchEnd: No touchStart recorded');
        return;
      }

      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const endTime = Date.now();

      const startX = touchStartRef.current.x;
      const startY = touchStartRef.current.y;
      const startTime = touchStartRef.current.time;

      // Reset
      touchStartRef.current = null;

      // Calculate movement and duration
      const deltaX = Math.abs(endX - startX);
      const deltaY = Math.abs(endY - startY);
      const duration = endTime - startTime;

      const isTap = duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

      log('TouchEnd:', { startX, endX, deltaX, deltaY, duration, isTap });

      if (!isTap) {
        log('Not a tap - ignoring');
        return;
      }

      // Handle navigation based on zone
      const action = getNavigationAction(startX);
      log('Navigation action:', action);

      if (action === 'prev') {
        log('LEFT ZONE TAP - calling prevPage()');
        e.preventDefault();
        e.stopPropagation();
        prevPageRef.current();
      } else if (action === 'next') {
        log('RIGHT ZONE TAP - calling nextPage()');
        e.preventDefault();
        e.stopPropagation();
        nextPageRef.current();
      } else {
        log('CENTER ZONE TAP - no navigation');
        // Don't prevent default in center - allow text selection and description clicks
      }
    };

    // ===== CLICK HANDLER (for desktop) =====

    const handleClick = (e: MouseEvent) => {
      if (!enabledRef.current) return;

      const x = e.clientX;
      log('Click:', { x, target: (e.target as HTMLElement)?.tagName });

      // Check if click is on description highlight
      if (isDescriptionHighlight(e.target)) {
        log('Click on description highlight - allowing through');
        return;
      }

      // Handle navigation based on zone
      const action = getNavigationAction(x);
      log('Click action:', action);

      if (action === 'prev') {
        log('LEFT ZONE CLICK - calling prevPage()');
        e.preventDefault();
        e.stopPropagation();
        prevPageRef.current();
      } else if (action === 'next') {
        log('RIGHT ZONE CLICK - calling nextPage()');
        e.preventDefault();
        e.stopPropagation();
        nextPageRef.current();
      } else {
        log('CENTER ZONE CLICK - allowing through');
        // Don't prevent default - allow text selection and description clicks
      }
    };

    // Add handlers to viewer element with capture phase
    log('Adding event listeners to viewer');
    viewer.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
    viewer.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
    viewer.addEventListener('click', handleClick, { capture: true });

    // ===== CLEANUP =====
    return () => {
      log('Cleaning up touch navigation');
      viewer.removeEventListener('touchstart', handleTouchStart, { capture: true });
      viewer.removeEventListener('touchend', handleTouchEnd, { capture: true });
      viewer.removeEventListener('click', handleClick, { capture: true });
    };
  }, [viewerRef, rendition]); // Re-run when viewerRef or rendition changes
};
