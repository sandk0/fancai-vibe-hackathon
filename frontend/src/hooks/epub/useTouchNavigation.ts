/**
 * useTouchNavigation - Touch and swipe gestures for EPUB navigation
 *
 * Provides mobile-friendly touch navigation:
 * - Swipe left -> Next page
 * - Swipe right -> Previous page
 * - Tap left edge (25%) -> Previous page
 * - Tap right edge (25%) -> Next page
 * - Configurable swipe threshold and tap detection
 *
 * Swipe threshold is relative to screen width by default (10% of screen width,
 * minimum 50px). This provides better UX across different device sizes:
 * - iPhone SE (375px): 50px threshold (minimum)
 * - iPhone 14 (390px): 50px threshold (minimum)
 * - iPad (768px): 77px threshold
 * - Desktop (1920px): 192px threshold
 *
 * @param options.rendition - epub.js Rendition instance
 * @param options.nextPage - Function to go to next page
 * @param options.prevPage - Function to go to previous page
 * @param options.enabled - Whether touch navigation is enabled (default: true)
 * @param options.swipeThreshold - Override threshold in px (default: 10% of screen width, min 50px)
 * @param options.timeThreshold - Maximum swipe duration in ms (default: 300ms)
 *
 * @example
 * useTouchNavigation({ rendition, nextPage, prevPage, enabled: true });
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Rendition } from '@/types/epub';

// Tap detection constants
const TAP_MAX_DURATION = 350; // ms - more forgiving for slower taps on mobile
const TAP_MAX_MOVEMENT = 10; // px - maximum movement to be considered a tap
// Tap zone constants for edge navigation
const LEFT_ZONE_END = 0.25; // 25% from left edge
const RIGHT_ZONE_START = 0.75; // 75% from left (25% from right)

// Swipe threshold constants
const MIN_SWIPE_THRESHOLD = 50; // Minimum 50px threshold
const SWIPE_THRESHOLD_RATIO = 0.1; // 10% of screen width

/**
 * Calculate relative swipe threshold based on screen width.
 * Returns 10% of screen width or minimum 50px, whichever is larger.
 * Safe for SSR - returns minimum value if window is not available.
 */
const getRelativeSwipeThreshold = (): number => {
  if (typeof window === 'undefined') {
    return MIN_SWIPE_THRESHOLD;
  }
  return Math.max(MIN_SWIPE_THRESHOLD, window.innerWidth * SWIPE_THRESHOLD_RATIO);
};

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
  swipeThreshold, // If not provided, will use relative threshold (10% of screen width, min 50px)
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
      // Check if tap is on highlight span - don't navigate, let click handler open modal
      const target = e.target as HTMLElement;
      if (target?.classList?.contains('description-highlight') ||
          target?.closest('.description-highlight')) {
        // Don't navigate - let click handler open modal
        return;
      }

      // Handle edge taps for navigation
      const tapX = touchEnd.x;
      const screenWidth = window.innerWidth;
      const leftZone = screenWidth * LEFT_ZONE_END;
      const rightZone = screenWidth * RIGHT_ZONE_START;

      if (tapX < leftZone) {
        e.preventDefault(); // Block text selection and phantom clicks
        e.stopPropagation();
        if (import.meta.env.DEV) {
          console.log('[useTouchNavigation] Left edge tap -> prev page');
        }
        prevPage();
        return;
      } else if (tapX > rightZone) {
        e.preventDefault(); // Block text selection and phantom clicks
        e.stopPropagation();
        if (import.meta.env.DEV) {
          console.log('[useTouchNavigation] Right edge tap -> next page');
        }
        nextPage();
        return;
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

    // Get current threshold - recalculate dynamically to handle window resize
    // Use provided threshold if available, otherwise compute relative threshold
    const currentThreshold = swipeThreshold ?? getRelativeSwipeThreshold();

    // Must exceed minimum distance (relative to screen width for better UX on different devices)
    if (absX < currentThreshold) {
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

      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: false });
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
