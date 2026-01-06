/**
 * useTouchNavigation - Edge tap navigation for EPUB reader
 *
 * - Tap left 25% = previous page
 * - Tap right 25% = next page
 * - Tap center 50% = do nothing (allow text selection and description clicks)
 *
 * ARCHITECTURE:
 * epub.js handles touch/click events on TWO levels:
 * 1. Container level (epub.js manager) - for swipe/tap navigation
 * 2. Inside iframe - for content interaction
 *
 * We intercept at BOTH levels:
 * - Container: Block epub.js swipe/tap handlers
 * - Iframe: Handle our custom navigation zones
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
   * Main effect - setup handlers when rendition is ready
   */
  useEffect(() => {
    if (!rendition) return;

    log('Setting up touch navigation handlers');

    // Get the epub.js container element
    // @ts-expect-error - accessing internal epub.js property
    const manager = rendition.manager;
    const container = manager?.container as HTMLElement | undefined;

    if (!container) {
      log('ERROR: Could not find epub.js container, trying viewerRef fallback');
    } else {
      log('Found epub.js container:', container.tagName, container.className);
    }

    // Use the main window width for zone calculations
    const getScreenWidth = () => window.innerWidth;

    /**
     * Determine navigation action based on X coordinate
     */
    const getNavigationAction = (x: number): 'prev' | 'next' | 'none' => {
      const screenWidth = getScreenWidth();
      const leftThreshold = screenWidth * LEFT_ZONE_END;
      const rightThreshold = screenWidth * RIGHT_ZONE_START;

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

    // ===== CONTAINER LEVEL HANDLERS =====
    // These block epub.js default navigation

    const containerTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return;

      const touch = e.touches[0];
      const x = touch.clientX;

      log('Container touchstart:', { x, screenWidth: getScreenWidth() });

      touchStartRef.current = {
        x,
        y: touch.clientY,
        time: Date.now(),
      };

      // Always prevent default on container to block epub.js
      e.preventDefault();
      e.stopPropagation();
    };

    const containerTouchMove = (e: TouchEvent) => {
      // Block epub.js swipe detection
      e.preventDefault();
      e.stopPropagation();
    };

    const containerTouchEnd = (e: TouchEvent) => {
      if (!enabledRef.current) return;

      // Always prevent default to block epub.js
      e.preventDefault();
      e.stopPropagation();

      if (!touchStartRef.current) return;

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

      log('Container touchend:', { startX, deltaX, deltaY, duration, isTap });

      if (!isTap) {
        log('Not a tap - ignoring');
        return;
      }

      // Check if tap is on description highlight
      if (isDescriptionHighlight(e.target)) {
        log('Tap on description highlight - allowing through');
        return;
      }

      // Handle navigation based on zone
      const action = getNavigationAction(startX);
      log('Navigation action:', action);

      if (action === 'prev') {
        log('LEFT ZONE TAP - navigating to previous page');
        prevPageRef.current();
      } else if (action === 'next') {
        log('RIGHT ZONE TAP - navigating to next page');
        nextPageRef.current();
      } else {
        log('CENTER ZONE TAP - no navigation');
      }
    };

    const containerClick = (e: MouseEvent) => {
      if (!enabledRef.current) return;

      log('Container click:', { x: e.clientX });

      // Check if click is on description highlight
      if (isDescriptionHighlight(e.target)) {
        log('Click on description highlight - allowing through');
        return;
      }

      // Block all other clicks to prevent epub.js navigation
      e.preventDefault();
      e.stopPropagation();

      // Handle desktop clicks
      const action = getNavigationAction(e.clientX);
      log('Click action:', action);

      if (action === 'prev') {
        log('LEFT ZONE CLICK - navigating to previous page');
        prevPageRef.current();
      } else if (action === 'next') {
        log('RIGHT ZONE CLICK - navigating to next page');
        nextPageRef.current();
      } else {
        log('CENTER ZONE CLICK - no navigation');
      }
    };

    // Add container handlers if container found
    if (container) {
      log('Adding handlers to container');
      container.addEventListener('touchstart', containerTouchStart, { capture: true, passive: false });
      container.addEventListener('touchmove', containerTouchMove, { capture: true, passive: false });
      container.addEventListener('touchend', containerTouchEnd, { capture: true, passive: false });
      container.addEventListener('click', containerClick, { capture: true });
    }

    // ===== RENDITION CLICK HANDLER =====
    // This handles clicks that come through from the iframe

    const renditionClickHandler = (event: MouseEvent, contents: unknown) => {
      if (!enabledRef.current) return;

      // @ts-expect-error - contents has window property
      const iframeWindow = contents?.window || window;
      const x = event.clientX;

      log('Rendition click:', { x, iframeWidth: iframeWindow.innerWidth });

      // Check if click is on description highlight
      if (isDescriptionHighlight(event.target)) {
        log('Rendition click on description highlight - allowing through');
        return;
      }

      // Block and handle
      event.preventDefault();
      event.stopPropagation();

      // Use iframe width for zone calculation (coordinates are relative to iframe)
      const screenWidth = iframeWindow.innerWidth || window.innerWidth;
      const leftThreshold = screenWidth * LEFT_ZONE_END;
      const rightThreshold = screenWidth * RIGHT_ZONE_START;

      if (x < leftThreshold) {
        log('LEFT ZONE (rendition) - navigating to previous page');
        prevPageRef.current();
      } else if (x > rightThreshold) {
        log('RIGHT ZONE (rendition) - navigating to next page');
        nextPageRef.current();
      } else {
        log('CENTER ZONE (rendition) - no navigation');
      }
    };

    rendition.on('click', renditionClickHandler);

    // ===== CLEANUP =====
    return () => {
      log('Cleaning up touch navigation');

      if (container) {
        container.removeEventListener('touchstart', containerTouchStart, { capture: true });
        container.removeEventListener('touchmove', containerTouchMove, { capture: true });
        container.removeEventListener('touchend', containerTouchEnd, { capture: true });
        container.removeEventListener('click', containerClick, { capture: true });
      }

      rendition.off('click', renditionClickHandler);
    };
  }, [rendition]);
};
