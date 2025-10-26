/**
 * useTouchNavigation - Touch and swipe gestures for EPUB navigation
 *
 * Provides mobile-friendly swipe navigation:
 * - Swipe left → Next page
 * - Swipe right → Previous page
 * - Configurable swipe threshold and deadzone
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
import type { Rendition } from 'epubjs';

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

    // Reset touch start
    touchStartRef.current = null;

    // Check if this was a valid swipe
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Must be horizontal swipe (more X than Y movement)
    if (absX < absY) {
      console.log('⏭️ [useTouchNavigation] Vertical swipe ignored');
      return;
    }

    // Must exceed minimum distance
    if (absX < swipeThreshold) {
      console.log('⏭️ [useTouchNavigation] Swipe too short:', absX + 'px');
      return;
    }

    // Must be quick enough
    if (deltaTime > timeThreshold) {
      console.log('⏭️ [useTouchNavigation] Swipe too slow:', deltaTime + 'ms');
      return;
    }

    // Determine direction and navigate
    if (deltaX > 0) {
      // Swipe right → Previous page
      console.log('👈 [useTouchNavigation] Swipe right detected, going to previous page');
      prevPage();
    } else {
      // Swipe left → Next page
      console.log('👉 [useTouchNavigation] Swipe left detected, going to next page');
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
        const contents = rendition.getContents() as any;
        if (contents && contents.length > 0) {
          return contents[0].document;
        }
        return null;
      } catch (err) {
        console.warn('⚠️ [useTouchNavigation] Could not get container:', err);
        return null;
      }
    };

    // Wait for rendition to be ready
    const setupListeners = () => {
      const container = getContainer();
      if (!container) {
        console.warn('⚠️ [useTouchNavigation] No container available');
        return;
      }

      console.log('👆 [useTouchNavigation] Setting up touch listeners');

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
