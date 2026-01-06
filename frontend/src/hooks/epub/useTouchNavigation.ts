/**
 * useTouchNavigation - Edge tap navigation for EPUB reader
 *
 * - Tap left 25% = previous page
 * - Tap right 25% = next page
 * - Tap center 50% = do nothing (allow text selection and description clicks)
 *
 * ARCHITECTURE:
 * epub.js has its own click handlers that navigate on any click.
 * We inject our handlers DIRECTLY into the iframe document with capture phase
 * to intercept clicks BEFORE epub.js can process them.
 *
 * Key insight: rendition.on('click') fires AFTER epub.js has already processed
 * the click, so we can't stop navigation from there. We need capture phase
 * handlers in the iframe document.
 */

import { useEffect, useRef } from 'react';
import type { Rendition } from '@/types/epub';

const TAP_MAX_DURATION = 350; // ms - max duration to be considered a tap
const TAP_MAX_MOVEMENT = 20; // px - increased for mobile tolerance
const LEFT_ZONE_END = 0.25;
const RIGHT_ZONE_START = 0.75;

// Debug logging - ALWAYS ON for now to diagnose mobile issues
const log = (...args: unknown[]) => console.log('[TouchNav]', ...args);

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
   * Setup handlers when rendition is ready
   */
  useEffect(() => {
    if (!rendition) return;

    log('Setting up touch navigation handlers');

    // Track cleanup functions for each iframe
    const cleanupFunctions: (() => void)[] = [];

    /**
     * Setup handlers on an iframe document
     * Uses capture phase to intercept events BEFORE epub.js processes them
     */
    const setupIframeHandlers = (doc: Document, index: number) => {
      const iframeWindow = doc.defaultView;
      if (!iframeWindow) return;

      log(`Setting up handlers on iframe ${index}, width: ${iframeWindow.innerWidth}`);

      // Click handler - capture phase to intercept before epub.js
      const handleClick = (e: MouseEvent) => {
        if (!enabledRef.current) return;

        const screenWidth = iframeWindow.innerWidth;
        const x = e.clientX;

        log('Click detected:', { x, screenWidth, target: (e.target as HTMLElement)?.tagName });

        // Check if click is on a description highlight - let it through
        const target = e.target as HTMLElement;
        if (target?.classList?.contains('description-highlight') || target?.closest?.('.description-highlight')) {
          log('Click on description highlight - allowing through');
          return; // Don't prevent default - let the highlight handler work
        }

        // Calculate zones
        const leftThreshold = screenWidth * LEFT_ZONE_END;
        const rightThreshold = screenWidth * RIGHT_ZONE_START;

        if (x < leftThreshold) {
          log('LEFT ZONE CLICK - navigating to previous page');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation(); // Stop ALL other handlers
          prevPageRef.current();
        } else if (x > rightThreshold) {
          log('RIGHT ZONE CLICK - navigating to next page');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation(); // Stop ALL other handlers
          nextPageRef.current();
        } else {
          log('CENTER ZONE - blocking epub.js navigation');
          // Block epub.js from navigating, but allow our description click handlers
          // Don't call stopImmediatePropagation to allow other handlers
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // Touch start handler
      const handleTouchStart = (e: TouchEvent) => {
        if (!enabledRef.current) return;

        const touch = e.touches[0];
        const x = touch.clientX;
        const screenWidth = iframeWindow.innerWidth;

        touchStartRef.current = {
          x,
          y: touch.clientY,
          time: Date.now(),
        };

        log('Touch start:', { x, screenWidth });

        // If touch starts in edge zone, prevent text selection
        const leftThreshold = screenWidth * LEFT_ZONE_END;
        const rightThreshold = screenWidth * RIGHT_ZONE_START;

        if (x < leftThreshold || x > rightThreshold) {
          log('Touch started in edge zone, preventing default');
          e.preventDefault();
        }
      };

      // Touch end handler
      const handleTouchEnd = (e: TouchEvent) => {
        if (!enabledRef.current || !touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;
        const endTime = Date.now();

        const startX = touchStartRef.current.x;
        const startY = touchStartRef.current.y;
        const startTime = touchStartRef.current.time;

        // Calculate movement and duration
        const deltaX = Math.abs(endX - startX);
        const deltaY = Math.abs(endY - startY);
        const duration = endTime - startTime;

        // Reset touch start
        touchStartRef.current = null;

        // Check if it's a tap (quick, minimal movement)
        const isTap = duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

        if (!isTap) {
          log('Not a tap - movement or duration too large:', { deltaX, deltaY, duration });
          return;
        }

        // Check if tap is on a description highlight - let it through
        const target = e.target as HTMLElement;
        if (target?.classList?.contains('description-highlight') || target?.closest?.('.description-highlight')) {
          log('Tap on description highlight - allowing through');
          return;
        }

        const screenWidth = iframeWindow.innerWidth;
        const leftThreshold = screenWidth * LEFT_ZONE_END;
        const rightThreshold = screenWidth * RIGHT_ZONE_START;

        log('Tap detected:', { startX, screenWidth, leftThreshold, rightThreshold });

        if (startX < leftThreshold) {
          log('LEFT ZONE TAP - navigating to previous page');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          prevPageRef.current();
        } else if (startX > rightThreshold) {
          log('RIGHT ZONE TAP - navigating to next page');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          nextPageRef.current();
        } else {
          log('CENTER ZONE TAP - blocking epub.js navigation');
          e.preventDefault();
          e.stopPropagation();
          // Don't call stopImmediatePropagation - allow description highlight handlers
        }
      };

      // Add handlers with capture phase to intercept before epub.js
      doc.addEventListener('click', handleClick, { capture: true });
      doc.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
      doc.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });

      log(`Handlers added to iframe ${index}`);

      // Return cleanup function
      return () => {
        doc.removeEventListener('click', handleClick, { capture: true });
        doc.removeEventListener('touchstart', handleTouchStart, { capture: true });
        doc.removeEventListener('touchend', handleTouchEnd, { capture: true });
        log(`Handlers removed from iframe ${index}`);
      };
    };

    /**
     * Setup handlers on all current iframes
     */
    const setupAllHandlers = () => {
      // Clean up previous handlers first
      cleanupFunctions.forEach(cleanup => cleanup());
      cleanupFunctions.length = 0;

      const contents = rendition.getContents();
      if (!contents || contents.length === 0) {
        log('No contents yet');
        return;
      }

      contents.forEach((content: { document?: Document }, index: number) => {
        const doc = content.document;
        if (!doc) return;

        const cleanup = setupIframeHandlers(doc, index);
        if (cleanup) {
          cleanupFunctions.push(cleanup);
        }
      });
    };

    // Setup handlers immediately if contents available
    setupAllHandlers();

    // Also setup on every 'rendered' event (when new content is loaded)
    const handleRendered = () => {
      log('Rendered event - setting up handlers');
      // Small delay to ensure iframe is ready
      setTimeout(setupAllHandlers, 50);
    };

    rendition.on('rendered', handleRendered);

    return () => {
      log('Cleaning up touch navigation');
      rendition.off('rendered', handleRendered);
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [rendition]);
};
