/**
 * useCFITracking - Custom hook for tracking EPUB CFI positions and progress
 *
 * CFI (Canonical Fragment Identifier) is an EPUB standard for precise location tracking.
 * This hook manages:
 * - Current reading position (CFI)
 * - Progress percentage (0-100)
 * - Current page number and total pages (from epub.js locations)
 * - Position restoration from saved CFI
 * - Hybrid CFI + scroll offset for pixel-perfect restoration
 *
 * Fixes the CFI jump issue where epub.js rounds to nearest paragraph.
 *
 * Page Numbers:
 * - Uses epub.js locations.locationFromCfi() to convert CFI → page number
 * - Page numbers are 1-based (first page = 1, not 0)
 * - Total pages comes from locations.total
 * - Both return null until locations are generated
 *
 * @param rendition - epub.js Rendition instance
 * @param locations - Generated locations for progress calculation
 * @param book - epub.js Book instance
 * @returns Current CFI, progress, page numbers, and navigation functions
 *
 * @example
 * const {
 *   currentCFI,
 *   progress,
 *   currentPage,
 *   totalPages,
 *   goToCFI,
 *   skipNextRelocated
 * } = useCFITracking(rendition, locations, book);
 *
 * // Display: "Стр. 42/500 (8%)"
 * console.log(`Стр. ${currentPage}/${totalPages} (${progress}%)`);
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Rendition, Book, EpubLocationEvent, EpubLocations } from '@/types/epub';

/**
 * Validate CFI format
 * CFI must start with "epubcfi(" and end with ")"
 * Basic validation to catch corrupted or malformed CFIs
 */
const isValidCFI = (cfi: string): boolean => {
  if (!cfi || typeof cfi !== 'string') return false;

  // Basic CFI format: epubcfi(/6/4!/4/2/...)
  const cfiPattern = /^epubcfi\([^)]+\)$/;

  if (!cfiPattern.test(cfi)) {
    console.warn('⚠️ [CFI Validation] Invalid CFI format:', cfi.substring(0, 50));
    return false;
  }

  // Check for minimum length (shortest valid CFI is ~15 chars)
  if (cfi.length < 15) {
    console.warn('⚠️ [CFI Validation] CFI too short:', cfi);
    return false;
  }

  return true;
};

interface UseCFITrackingOptions {
  rendition: Rendition | null;
  locations: EpubLocations | null;
  book: Book | null;
  onLocationChange?: (cfi: string, progress: number, scrollOffset: number) => void;
}

interface UseCFITrackingReturn {
  currentCFI: string;
  progress: number;
  scrollOffsetPercent: number;
  currentPage: number | null;
  totalPages: number | null;
  goToCFI: (cfi: string, scrollOffset?: number) => Promise<void>;
  skipNextRelocated: () => void;
  setInitialProgress: (cfi: string, progressPercent: number) => void;
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
   * Set initial progress manually (used during position restoration)
   */
  const setInitialProgress = useCallback((cfi: string, progressPercent: number) => {
    console.log('🎯 [useCFITracking] Setting initial progress:', {
      cfi: cfi.substring(0, 50) + '...',
      progress: progressPercent + '%',
    });
    setCurrentCFI(cfi);
    setProgress(progressPercent);
  }, []);

  /**
   * Skip the next relocated event (used during restoration)
   */
  const skipNextRelocated = useCallback(() => {
    restoredCfiRef.current = currentCFI;
    console.log('🔒 [useCFITracking] Next relocated event will be skipped');
  }, [currentCFI]);

  /**
   * Navigate to a specific CFI with optional scroll offset
   * Validates CFI format before navigation and throws error if invalid
   */
  const goToCFI = useCallback(async (cfi: string, scrollOffset?: number) => {
    if (!rendition || !cfi) return;

    // Validate CFI format before attempting navigation
    if (!isValidCFI(cfi)) {
      throw new Error(`Invalid CFI format: ${cfi.substring(0, 50)}...`);
    }

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

        const contents = rendition.getContents();
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
      const contents = rendition.getContents();
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

    const handleRelocated = (location: EpubLocationEvent) => {
      const cfi = location.start.cfi;

      // Skip if this is the CFI we just restored
      if (restoredCfiRef.current && cfi === restoredCfiRef.current) {
        console.log('⏳ [useCFITracking] Skipping relocated - exact match with restored CFI');
        return;
      }

      // Check if within 3% threshold (epub.js rounding)
      if (restoredCfiRef.current && locations.total > 0) {
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
      const locationsTotal = locations?.total || 0;

      if (locationsTotal > 0) {
        const currentLocation = locations.percentageFromCfi(cfi);
        progressPercent = Math.round((currentLocation || 0) * 100);
      } else {
        // Fallback to currentLocation()
        const current = rendition.currentLocation();
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

    rendition.on('relocated', handleRelocated as (...args: unknown[]) => void);

    return () => {
      rendition.off('relocated', handleRelocated as (...args: unknown[]) => void);
    };
  }, [rendition, locations, book, onLocationChange, calculateScrollOffset]);

  /**
   * Calculate current page number from CFI
   *
   * epub.js provides locationFromCfi() to get the page number.
   * This converts a CFI (Canonical Fragment Identifier) to a numeric page number.
   *
   * @returns Page number (1-based) or null if locations not ready
   *
   * @example
   * // If current CFI is "epubcfi(/6/4!/4/2)" and locations are generated:
   * // currentPage might be 42 (out of 500 total pages)
   */
  const currentPage = useMemo(() => {
    if (!locations || !currentCFI || !locations.total) return null;

    try {
      // locationFromCfi returns the page number (1-based index)
      const pageNumber = locations.locationFromCfi(currentCFI);
      const validPage = pageNumber !== -1 ? pageNumber : null;

      if (validPage !== null) {
        console.log('📄 [useCFITracking] Current page:', validPage, '/', locations.total);
      }

      return validPage;
    } catch (err) {
      console.warn('⚠️ [useCFITracking] Could not get page from CFI:', err);
      return null;
    }
  }, [locations, currentCFI]);

  /**
   * Get total pages from locations
   *
   * epub.js generates "locations" which divides the book into fixed-size pages.
   * This provides a consistent page numbering system across different screen sizes.
   *
   * @returns Total number of pages in the book, or null if locations not generated yet
   *
   * @example
   * // After locations are generated for "War and Peace":
   * // totalPages might be 1523
   */
  const totalPages = useMemo(() => {
    if (!locations || !locations.total) return null;

    const total = locations.total;
    console.log('📚 [useCFITracking] Total pages available:', total);

    return total;
  }, [locations]);

  return {
    currentCFI,
    progress,
    scrollOffsetPercent,
    currentPage,
    totalPages,
    goToCFI,
    skipNextRelocated,
    setInitialProgress,
  };
};
