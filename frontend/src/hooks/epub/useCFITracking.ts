/**
 * useCFITracking - Custom hook for tracking EPUB CFI positions and progress
 *
 * CFI (Canonical Fragment Identifier) is an EPUB standard for precise location tracking.
 * This hook manages:
 * - Current reading position (CFI)
 * - Progress percentage (0-100)
 * - Position restoration from saved CFI
 * - Hybrid CFI + scroll offset for pixel-perfect restoration
 *
 * Fixes the CFI jump issue where epub.js rounds to nearest paragraph.
 *
 * @param rendition - epub.js Rendition instance
 * @param locations - Generated locations for progress calculation
 * @param book - epub.js Book instance
 * @returns Current CFI, progress, and navigation functions
 *
 * @example
 * const { currentCFI, progress, goToCFI, skipNextRelocated } = useCFITracking(
 *   rendition,
 *   locations,
 *   book
 * );
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Rendition, Book } from 'epubjs';

interface UseCFITrackingOptions {
  rendition: Rendition | null;
  locations: any | null; // epub.js doesn't export Locations type
  book: Book | null;
  onLocationChange?: (cfi: string, progress: number, scrollOffset: number) => void;
}

interface UseCFITrackingReturn {
  currentCFI: string;
  progress: number;
  scrollOffsetPercent: number;
  goToCFI: (cfi: string, scrollOffset?: number) => Promise<void>;
  skipNextRelocated: () => void;
}

export const useCFITracking = ({
  rendition,
  locations,
  book,
  onLocationChange,
}: UseCFITrackingOptions): UseCFITrackingReturn => {
  const [currentCFI, setCurrentCFI] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [scrollOffsetPercent, setScrollOffsetPercent] = useState<number>(0);

  const restoredCfiRef = useRef<string | null>(null);

  /**
   * Skip the next relocated event (used during restoration)
   */
  const skipNextRelocated = useCallback(() => {
    restoredCfiRef.current = currentCFI;
    console.log('🔒 [useCFITracking] Next relocated event will be skipped');
  }, [currentCFI]);

  /**
   * Navigate to a specific CFI with optional scroll offset
   */
  const goToCFI = useCallback(async (cfi: string, scrollOffset?: number) => {
    if (!rendition || !cfi) return;

    try {
      console.log('🎯 [useCFITracking] Navigating to CFI:', cfi.substring(0, 80) + '...');

      // Mark this CFI as restored to skip auto-save
      restoredCfiRef.current = cfi;

      // Display the CFI
      await rendition.display(cfi);

      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Apply scroll offset if provided (hybrid approach)
      if (scrollOffset !== undefined && scrollOffset > 0) {
        console.log('🔧 [useCFITracking] Applying scroll offset:', scrollOffset.toFixed(2) + '%');

        await new Promise(resolve => setTimeout(resolve, 200));

        const contents = rendition.getContents() as any;
        if (contents && contents.length > 0) {
          const iframe = contents[0];
          const doc = iframe.document;

          if (doc && doc.documentElement) {
            const scrollHeight = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 0;
            const clientHeight = doc.documentElement.clientHeight || doc.body?.clientHeight || 0;
            const maxScroll = scrollHeight - clientHeight;

            if (maxScroll > 0) {
              const targetScrollTop = (scrollOffset / 100) * maxScroll;
              doc.documentElement.scrollTop = targetScrollTop;
              if (doc.body) {
                doc.body.scrollTop = targetScrollTop;
              }

              console.log('✅ [useCFITracking] Scroll offset applied:', {
                targetScrollTop,
                maxScroll,
                requestedOffset: scrollOffset.toFixed(2) + '%'
              });
            }
          }
        }
      }

    } catch (err) {
      console.error('❌ [useCFITracking] Error navigating to CFI:', err);
    }
  }, [rendition]);

  /**
   * Calculate scroll offset percentage within current page
   */
  const calculateScrollOffset = useCallback((): number => {
    if (!rendition) return 0;

    try {
      const contents = rendition.getContents() as any;
      if (!contents || contents.length === 0) return 0;

      const iframe = contents[0];
      const doc = iframe.document;

      if (!doc || !doc.documentElement) return 0;

      const scrollTop = doc.documentElement.scrollTop || doc.body?.scrollTop || 0;
      const scrollHeight = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 0;
      const clientHeight = doc.documentElement.clientHeight || doc.body?.clientHeight || 0;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return 0;

      return (scrollTop / maxScroll) * 100;
    } catch (err) {
      console.warn('⚠️ [useCFITracking] Error calculating scroll offset:', err);
      return 0;
    }
  }, [rendition]);

  /**
   * Listen to relocated events from epub.js
   */
  useEffect(() => {
    if (!rendition || !locations || !book) return;

    const handleRelocated = (location: any) => {
      const cfi = location.start.cfi;

      // Skip if this is the CFI we just restored
      if (restoredCfiRef.current && cfi === restoredCfiRef.current) {
        console.log('⏳ [useCFITracking] Skipping relocated - exact match with restored CFI');
        return;
      }

      // Check if within 3% threshold (epub.js rounding)
      if (restoredCfiRef.current && (locations as any).total > 0) {
        const restoredPercent = Math.round((locations.percentageFromCfi(restoredCfiRef.current) || 0) * 100);
        const currentPercent = Math.round((locations.percentageFromCfi(cfi) || 0) * 100);

        if (Math.abs(currentPercent - restoredPercent) <= 3) {
          console.log('⏳ [useCFITracking] Skipping relocated - within 3% threshold');
          restoredCfiRef.current = null; // Clear after first event
          return;
        }

        console.log('✅ [useCFITracking] First real page turn detected');
        restoredCfiRef.current = null;
      }

      // Calculate progress
      let progressPercent = 0;
      const locationsTotal = (locations as any)?.total || 0;

      if (locationsTotal > 0) {
        const currentLocation = locations.percentageFromCfi(cfi);
        progressPercent = Math.round((currentLocation || 0) * 100);
      } else {
        // Fallback to currentLocation()
        const current = rendition.currentLocation() as any;
        if (current && current.start && current.start.percentage !== undefined) {
          progressPercent = Math.round(current.start.percentage * 100);
        }
      }

      // Calculate scroll offset
      const scrollOffset = calculateScrollOffset();

      console.log('📍 [useCFITracking] Location changed:', {
        cfi: cfi.substring(0, 50) + '...',
        progress: progressPercent + '%',
        scrollOffset: scrollOffset.toFixed(2) + '%',
      });

      // Update state
      setCurrentCFI(cfi);
      setProgress(progressPercent);
      setScrollOffsetPercent(scrollOffset);

      // Callback for external handling (e.g., save to backend)
      if (onLocationChange) {
        onLocationChange(cfi, progressPercent, scrollOffset);
      }
    };

    rendition.on('relocated', handleRelocated);

    return () => {
      rendition.off('relocated', handleRelocated);
    };
  }, [rendition, locations, book, onLocationChange, calculateScrollOffset]);

  return {
    currentCFI,
    progress,
    scrollOffsetPercent,
    goToCFI,
    skipNextRelocated,
  };
};
