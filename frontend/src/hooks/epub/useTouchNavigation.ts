/**
 * useTouchNavigation - Edge tap navigation for EPUB reader
 *
 * - Tap left 25% = previous page
 * - Tap right 25% = next page
 * - Tap center 50% = do nothing (allow text selection)
 *
 * No swipe gestures - simplified for reliability and better text selection support.
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Rendition } from '@/types/epub';

const TAP_MAX_DURATION = 350; // ms
const TAP_MAX_MOVEMENT = 15; // px
const LEFT_ZONE_END = 0.25;
const RIGHT_ZONE_START = 0.75;

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
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Determine if X coordinate is in edge zone
  const isLeftEdge = useCallback((x: number) => {
    return x < window.innerWidth * LEFT_ZONE_END;
  }, []);

  const isRightEdge = useCallback((x: number) => {
    return x > window.innerWidth * RIGHT_ZONE_START;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      const x = touch.clientX;

      // If touch starts in edge zone, prevent text selection immediately
      if (isLeftEdge(x) || isRightEdge(x)) {
        e.preventDefault();
      }

      touchStartRef.current = {
        x,
        y: touch.clientY,
        time: Date.now(),
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

      // Reset
      touchStartRef.current = null;

      // Calculate movement and duration
      const deltaX = Math.abs(endX - startX);
      const deltaY = Math.abs(endY - startY);
      const duration = endTime - startTime;

      // Check if it's a tap (quick, minimal movement)
      const isTap =
        duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

      if (!isTap) return;

      // Check if tap is on a description highlight - let it handle the click
      const target = e.target as HTMLElement;
      if (target?.classList?.contains('description-highlight') || target?.closest('.description-highlight')) {
        return;
      }

      // Handle edge tap navigation
      if (isLeftEdge(startX)) {
        e.preventDefault();
        e.stopPropagation();
        prevPage();
      } else if (isRightEdge(startX)) {
        e.preventDefault();
        e.stopPropagation();
        nextPage();
      }
      // Center tap - do nothing, allow text selection
    },
    [enabled, nextPage, prevPage, isLeftEdge, isRightEdge]
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

        doc.addEventListener('touchstart', handleTouchStart, { passive: false });
        doc.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Store cleanup function
        cleanupRef.current = () => {
          doc.removeEventListener('touchstart', handleTouchStart);
          doc.removeEventListener('touchend', handleTouchEnd);
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
  }, [rendition, enabled, handleTouchStart, handleTouchEnd]);
};
