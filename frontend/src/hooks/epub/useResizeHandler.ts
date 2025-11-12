/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useResizeHandler - Handles rendition resize events
 *
 * When viewport resizes (window resize, mobile rotation, font size changes):
 * 1. Saves current CFI position before resize completes
 * 2. Waits for re-render to complete
 * 3. Restores exact reading position
 * 4. Triggers optional callback for UI updates
 *
 * Critical for:
 * - Window resize (desktop)
 * - Mobile rotation (portrait ↔ landscape)
 * - Font size changes (affects layout)
 * - Theme changes (if they affect layout)
 *
 * Performance optimizations:
 * - Uses requestAnimationFrame for smooth restoration
 * - Debounces rapid resize events (100ms)
 * - Minimal state updates
 * - Proper cleanup to prevent memory leaks
 *
 * @param rendition - epub.js Rendition instance
 * @param onResized - Optional callback with new dimensions
 * @param enabled - Whether resize handling is enabled (default: true)
 *
 * @example
 * useResizeHandler({
 *   rendition,
 *   onResized: (dimensions) => {
 *     console.log('New size:', dimensions);
 *     updateUI();
 *   },
 *   enabled: true,
 * });
 */

import { useEffect, useRef } from 'react';
import type { Rendition } from '@/types/epub';

interface UseResizeHandlerOptions {
  rendition: Rendition | null;
  onResized?: (dimensions: { width: number; height: number }) => void;
  enabled?: boolean;
}

/**
 * Debounce helper for rapid resize events
 */
const debounce = <T extends (...args: any[]) => void>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
};

export const useResizeHandler = ({
  rendition,
  onResized,
  enabled = true,
}: UseResizeHandlerOptions): void => {
  const lastCFI = useRef<string | null>(null);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    if (!rendition || !enabled) {
      console.log('📐 [useResizeHandler] Disabled or rendition not ready');
      return;
    }

    /**
     * Handle resize event with position preservation
     */
    const handleResized = (dimensions: { width: number; height: number }) => {
      console.log('📐 [useResizeHandler] Rendition resized:', dimensions);

      // Prevent concurrent restoration
      if (isRestoringRef.current) {
        console.log('⏭️ [useResizeHandler] Already restoring, skipping');
        return;
      }

      // Save current position BEFORE resize affects layout
      const currentLocation = rendition.currentLocation() as any;
      if (currentLocation?.start?.cfi) {
        lastCFI.current = currentLocation.start.cfi;
        console.log('💾 [useResizeHandler] Saved CFI:', (lastCFI.current || '').substring(0, 80) + '...');
      }

      // Call optional callback (e.g., update UI state)
      if (onResized) {
        onResized(dimensions);
      }

      // Restore position after resize completes
      // Use requestAnimationFrame for smooth rendering
      isRestoringRef.current = true;

      requestAnimationFrame(() => {
        // Give epub.js time to re-render
        setTimeout(() => {
          if (lastCFI.current) {
            console.log('↩️ [useResizeHandler] Restoring position after resize');

            rendition
              .display(lastCFI.current)
              .then(() => {
                console.log('✅ [useResizeHandler] Position restored successfully');
              })
              .catch((err) => {
                console.warn('⚠️ [useResizeHandler] Could not restore position:', err);
              })
              .finally(() => {
                isRestoringRef.current = false;
              });
          } else {
            isRestoringRef.current = false;
          }
        }, 100);
      });
    };

    // Debounce to handle rapid resize events (e.g., dragging window edge)
    const debouncedHandleResized = debounce(handleResized, 100);

    rendition.on('resized', debouncedHandleResized as (...args: unknown[]) => void);

    console.log('✅ [useResizeHandler] Resize handler registered');

    return () => {
      rendition.off('resized', debouncedHandleResized as (...args: unknown[]) => void);
      console.log('🧹 [useResizeHandler] Resize handler deregistered');
    };
  }, [rendition, enabled, onResized]);
};
