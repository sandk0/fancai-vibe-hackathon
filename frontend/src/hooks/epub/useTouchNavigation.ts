/**
 * useTouchNavigation - Touch and swipe gestures for EPUB navigation
 *
 * Provides mobile-friendly touch navigation:
 * - Swipe left → Next page
 * - Swipe right → Previous page
 * - Tap left edge (25%) → Previous page
 * - Tap right edge (25%) → Next page
 * - Configurable swipe threshold and tap detection
 *
 * @param rendition - epub.js Rendition instance
 * @param nextPage - Function to go to next page
 * @param prevPage - Function to go to previous page
 * @param enabled - Whether touch navigation is enabled
 *
 * @example
 * useTouchNavigation(rendition, nextPage, prevPage, true);
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Rendition } from '@/types/epub';

// Tap detection constants
const TAP_MAX_DURATION = 200; // ms - maximum duration to be considered a tap
const TAP_MAX_MOVEMENT = 10; // px - maximum movement to be considered a tap
// Tap zone constants for edge navigation
const LEFT_ZONE_END = 0.25; // 25% from left edge
const RIGHT_ZONE_START = 0.75; // 75% from left (25% from right)

interface UseTouchNavigationOptions {
  rendition: Rendition | null;
  nextPage: () => void;
  prevPage: () => void;
  enabled?: boolean;
  swipeThreshold?: number; // Minimum distance for swipe (px)
  timeThreshold?: number; // Maximum time for swipe (ms)
}

export const useTouchNavigation = ({
  rendition,
  nextPage,
  prevPage,
  enabled = true,
  swipeThreshold = 50, // 50px minimum swipe
  timeThreshold = 300, // 300ms maximum duration
}: UseTouchNavigationOptions): void => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const touchEnd = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    const deltaX = touchEnd.x - touchStartRef.current.x;
    const deltaY = touchEnd.y - touchStartRef.current.y;
    const deltaTime = touchEnd.time - touchStartRef.current.time;
    const touchDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Reset touch start
    touchStartRef.current = null;

    // Detect tap (quick touch with minimal movement)
    const isTap = deltaTime < TAP_MAX_DURATION && touchDistance < TAP_MAX_MOVEMENT;

    if (isTap) {
      // Handle edge taps for navigation
      const tapX = touchEnd.x;
      const screenWidth = window.innerWidth;
      const leftZone = screenWidth * LEFT_ZONE_END;
      const rightZone = screenWidth * RIGHT_ZONE_START;

      if (tapX < leftZone) {
        prevPage();
      } else if (tapX > rightZone) {
        nextPage();
      }
      // Center tap (25%-75%) does nothing - allows text selection and other interactions
      return;
    }

    // Check if this was a valid swipe
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Must be horizontal swipe (more X than Y movement)
    if (absX < absY) {
      return;
    }

    // Must exceed minimum distance
    if (absX < swipeThreshold) {
      return;
    }

    // Must be quick enough
    if (deltaTime > timeThreshold) {
      return;
    }

    // Determine direction and navigate
    if (deltaX > 0) {
      // Swipe right → Previous page
      prevPage();
    } else {
      // Swipe left → Next page
      nextPage();
    }
  }, [enabled, nextPage, prevPage, swipeThreshold, timeThreshold]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Prevent default scrolling during horizontal swipe
    if (!enabled || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // If horizontal swipe is dominant, prevent default scroll
    if (deltaX > deltaY && deltaX > 10) {
      e.preventDefault();
    }
  }, [enabled]);

  /**
   * Attach touch listeners to rendition iframe
   */
  useEffect(() => {
    if (!rendition || !enabled) return;

    // Get the iframe container
    const getContainer = () => {
      try {
        const contents = rendition.getContents();
        if (contents && contents.length > 0) {
          return contents[0].document;
        }
        return null;
      } catch (_err) {
        return null;
      }
    };

    // Wait for rendition to be ready
    const setupListeners = () => {
      const container = getContainer();
      if (!container) {
        return;
      }

      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchmove', handleTouchMove);
      };
    };

    // Setup on rendered event to ensure iframe is ready
    const handleRendered = () => {
      setTimeout(setupListeners, 100);
    };

    rendition.on('rendered', handleRendered);

    // Initial setup
    const cleanup = setupListeners();

    return () => {
      rendition.off('rendered', handleRendered);
      if (cleanup) cleanup();
    };
  }, [rendition, enabled, handleTouchStart, handleTouchEnd, handleTouchMove]);
};
