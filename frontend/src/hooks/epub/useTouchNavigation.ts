/**
 * useTouchNavigation - Touch/tap navigation for EPUB reader
 *
 * Uses epub.js content hooks to add handlers INSIDE the iframe,
 * solving the cross-origin event propagation issue.
 *
 * Tap zones:
 * - Left 25% = previous page
 * - Right 25% = next page
 * - Center 50% = allow text selection and description clicks
 *
 * ARCHITECTURE:
 * We use rendition.hooks.content.register() to add event listeners
 * directly to the iframe document, which is the epub.js recommended way.
 */

import { useEffect, useRef } from 'react';
import type { Rendition, Contents } from '@/types/epub';

const TAP_MAX_DURATION = 350; // ms - max duration to be considered a tap
const TAP_MAX_MOVEMENT = 20; // px - increased for mobile tolerance
const LEFT_ZONE_END = 0.25;
const RIGHT_ZONE_START = 0.75;

// Debug logging
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
  viewerRef,
  nextPage,
  prevPage,
  enabled = true,
}: UseTouchNavigationOptions): void => {
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

  /**
   * Main effect - setup handlers via epub.js content hooks
   */
  useEffect(() => {
    if (!rendition) {
      log('No rendition, skipping setup');
      return;
    }

    log('Setting up touch navigation via content hooks');

    // Track touch start for tap detection (per-iframe)
    const touchStarts = new WeakMap<Document, { x: number; y: number; time: number }>();

    /**
     * Determine navigation action based on X coordinate relative to viewport
     */
    const getNavigationAction = (x: number, viewportWidth: number): 'prev' | 'next' | 'none' => {
      const leftThreshold = viewportWidth * LEFT_ZONE_END;
      const rightThreshold = viewportWidth * RIGHT_ZONE_START;

      log('Zone check:', { x, viewportWidth, leftThreshold, rightThreshold });

      if (x < leftThreshold) return 'prev';
      if (x > rightThreshold) return 'next';
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
     * Content hook - runs when new content is rendered
     * This is the epub.js way to access iframe content
     */
    const contentHook = (contents: Contents) => {
      const doc = contents.document;
      if (!doc) {
        log('ERROR: No document in contents');
        return;
      }

      log('Content hook fired - adding handlers to iframe document');

      // Get viewport width from the iframe
      const getViewportWidth = () => doc.documentElement?.clientWidth || window.innerWidth;

      // ===== TOUCH HANDLERS =====

      const handleTouchStart = (e: TouchEvent) => {
        if (!enabledRef.current) return;

        const touch = e.touches[0];
        const x = touch.clientX;

        log('TouchStart (iframe):', { x, y: touch.clientY });

        touchStarts.set(doc, {
          x,
          y: touch.clientY,
          time: Date.now(),
        });

        // Check zone - if edge zone, prevent default to block text selection
        const action = getNavigationAction(x, getViewportWidth());
        if (action !== 'none') {
          log('Edge zone touch - preventing default');
          e.preventDefault();
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (!enabledRef.current) return;

        const touchStart = touchStarts.get(doc);
        if (!touchStart) {
          log('TouchEnd: No touchStart recorded');
          return;
        }

        const touch = e.changedTouches[0];
        const endX = touch.clientX;
        const endY = touch.clientY;
        const endTime = Date.now();

        const startX = touchStart.x;
        const startY = touchStart.y;
        const startTime = touchStart.time;

        // Reset
        touchStarts.delete(doc);

        // Calculate movement and duration
        const deltaX = Math.abs(endX - startX);
        const deltaY = Math.abs(endY - startY);
        const duration = endTime - startTime;

        const isTap = duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

        log('TouchEnd (iframe):', { startX, endX, deltaX, deltaY, duration, isTap });

        if (!isTap) {
          log('Not a tap - ignoring');
          return;
        }

        // Check if tap is on description highlight - allow through
        if (isDescriptionHighlight(e.target)) {
          log('Tap on description highlight - allowing through');
          return;
        }

        // Handle navigation based on zone
        const action = getNavigationAction(startX, getViewportWidth());
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
          log('CENTER ZONE TAP - allowing through');
          // Don't prevent default in center - allow text selection and description clicks
        }
      };

      // ===== CLICK HANDLER (for desktop) =====

      const handleClick = (e: MouseEvent) => {
        if (!enabledRef.current) return;

        const x = e.clientX;
        log('Click (iframe):', { x, target: (e.target as HTMLElement)?.tagName });

        // Check if click is on description highlight - allow through
        if (isDescriptionHighlight(e.target)) {
          log('Click on description highlight - allowing through');
          return;
        }

        // Handle navigation based on zone
        const action = getNavigationAction(x, getViewportWidth());
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

      // Add handlers to iframe document
      log('Adding event listeners to iframe document');
      doc.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
      doc.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
      doc.addEventListener('click', handleClick, { capture: true });

      // Return cleanup function (epub.js doesn't use this, but we track for manual cleanup)
      return () => {
        log('Cleaning up iframe event listeners');
        doc.removeEventListener('touchstart', handleTouchStart, { capture: true });
        doc.removeEventListener('touchend', handleTouchEnd, { capture: true });
        doc.removeEventListener('click', handleClick, { capture: true });
      };
    };

    // Register content hook with epub.js
    // This will be called for each new page/section rendered
    rendition.hooks.content.register(contentHook);

    log('Content hook registered');

    // Also add handlers to the viewer container for events that might propagate there
    const viewer = viewerRef.current;
    if (viewer) {
      log('Also adding fallback handlers to viewer container');

      let viewerTouchStart: { x: number; y: number; time: number } | null = null;

      const handleViewerTouchStart = (e: TouchEvent) => {
        if (!enabledRef.current) return;
        const touch = e.touches[0];
        viewerTouchStart = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
      };

      const handleViewerTouchEnd = (e: TouchEvent) => {
        if (!enabledRef.current || !viewerTouchStart) return;

        const touch = e.changedTouches[0];
        const deltaX = Math.abs(touch.clientX - viewerTouchStart.x);
        const deltaY = Math.abs(touch.clientY - viewerTouchStart.y);
        const duration = Date.now() - viewerTouchStart.time;
        const startX = viewerTouchStart.x;
        viewerTouchStart = null;

        const isTap = duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

        if (!isTap) return;

        const action = getNavigationAction(startX, window.innerWidth);
        log('Viewer tap action:', action);

        if (action === 'prev') {
          e.preventDefault();
          prevPageRef.current();
        } else if (action === 'next') {
          e.preventDefault();
          nextPageRef.current();
        }
      };

      viewer.addEventListener('touchstart', handleViewerTouchStart, { passive: true });
      viewer.addEventListener('touchend', handleViewerTouchEnd, { passive: false });

      return () => {
        log('Cleaning up touch navigation');
        // Note: epub.js doesn't provide a way to unregister hooks,
        // but rendition destruction will clean them up
        viewer.removeEventListener('touchstart', handleViewerTouchStart);
        viewer.removeEventListener('touchend', handleViewerTouchEnd);
      };
    }

    return () => {
      log('Cleaning up touch navigation');
      // Note: epub.js doesn't provide a way to unregister hooks,
      // but rendition destruction will clean them up
    };
  }, [rendition, viewerRef]);
};
