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

// Debug logging - ALWAYS ON for now to diagnose mobile issues
const devLog = (...args: unknown[]) => console.log('[useCFITracking]', ...args);

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
    devLog('CFI Validation warning: Invalid CFI format:', cfi.substring(0, 50));
    return false;
  }

  // Check for minimum length (shortest valid CFI is ~15 chars)
  if (cfi.length < 15) {
    devLog('CFI Validation warning: CFI too short:', cfi);
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
  progressValid: boolean; // NEW: Indicates if progress was successfully calculated
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
  book, // Used for fallback progress calculation before locations are ready
  onLocationChange,
}: UseCFITrackingOptions): UseCFITrackingReturn => {
  const [currentCFI, setCurrentCFI] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [progressValid, setProgressValid] = useState<boolean>(false); // NEW: Track if progress was calculated
  const [scrollOffsetPercent, setScrollOffsetPercent] = useState<number>(0);

  const restoredCfiRef = useRef<string | null>(null);

  /**
   * Set initial progress manually (used during position restoration)
   */
  const setInitialProgress = useCallback((cfi: string, progressPercent: number) => {
    devLog('Navigation: Setting initial progress:', {
      cfi: cfi.substring(0, 50) + '...',
      progress: progressPercent + '%',
    });
    setCurrentCFI(cfi);
    setProgress(progressPercent);
    setProgressValid(true); // Initial progress from server is always valid
  }, []);

  /**
   * Skip the next relocated event (used during restoration)
   */
  const skipNextRelocated = useCallback(() => {
    restoredCfiRef.current = currentCFI;
    devLog('Skip flag: Next relocated event will be skipped');
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
      devLog('Navigation: Navigating to CFI:', cfi.substring(0, 80) + '...');

      // Mark this CFI as restored to skip auto-save
      restoredCfiRef.current = cfi;

      // Display the CFI
      await rendition.display(cfi);

      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Apply scroll offset if provided (hybrid approach)
      if (scrollOffset !== undefined && scrollOffset > 0) {
        devLog('Scroll offset: Applying scroll offset:', scrollOffset.toFixed(2) + '%');

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

              devLog('Success: Scroll offset applied:', {
                targetScrollTop,
                maxScroll,
                requestedOffset: scrollOffset.toFixed(2) + '%'
              });
            }
          }
        }
      }

    } catch (err) {
      console.error('[useCFITracking] Error navigating to CFI:', err);
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
      devLog('Warning: Error calculating scroll offset:', err);
      return 0;
    }
  }, [rendition]);

  /**
   * UNIFIED Relocated Handler - Single source of truth for progress tracking
   *
   * CRITICAL FIX: Previously there were TWO separate effects registering handlers,
   * causing race conditions where the second handler would overwrite progress with 0.
   *
   * This unified handler:
   * 1. Works immediately when rendition is ready (spine-based fallback)
   * 2. Upgrades to location-based precision when locations become available
   * 3. Properly validates percentageFromCfi return values
   * 4. Handles position restoration skip logic
   */
  useEffect(() => {
    if (!rendition) return;

    devLog('Setting up UNIFIED relocated listener', {
      hasLocations: !!locations,
      locationsTotal: locations?.total,
      hasBook: !!book,
      spineItemsCount: book?.spine?.items?.length || book?.spine?.length || 0,
    });

    const handleRelocated = (location: EpubLocationEvent) => {
      const cfi = location.start.cfi;

      devLog('📍 RELOCATED event fired:', {
        cfi: cfi?.substring(0, 50),
        percentage: location?.start?.percentage,
        spineIndex: location?.start?.index,
        displayedPage: location?.start?.displayed?.page,
        displayedTotal: location?.start?.displayed?.total,
        hasLocations: !!locations,
        locationsTotal: locations?.total,
        hasRestoredCfi: !!restoredCfiRef.current,
      });

      // Track if this is a restoration event - we still update state but skip save callback
      // CRITICAL FIX: Previously we returned early and skipped ALL updates, which left
      // progress at 0 if server returned 0 (old data before fix)
      let isRestorationEvent = false;
      if (restoredCfiRef.current) {
        if (cfi === restoredCfiRef.current) {
          devLog('🔄 Restoration event detected - will update state but skip save');
          isRestorationEvent = true;
        }
        restoredCfiRef.current = null; // Clear in both cases
      }

      // Always update CFI
      setCurrentCFI(cfi);

      // Calculate progress - try multiple methods in order of precision
      let progressPercent: number | null = null;

      // Method 1: Use locations.percentageFromCfi (most precise, only after locations ready)
      if (locations && locations.total > 0) {
        try {
          const locationPercentage = locations.percentageFromCfi(cfi);
          devLog('Locations percentageFromCfi result:', locationPercentage);

          // Validate the result - must be a valid number between 0 and 1
          if (
            typeof locationPercentage === 'number' &&
            !Number.isNaN(locationPercentage) &&
            locationPercentage >= 0 &&
            locationPercentage <= 1
          ) {
            progressPercent = Math.round(locationPercentage * 1000) / 10;
            devLog('Progress from locations:', progressPercent + '%');
          } else {
            devLog('⚠️ Invalid locationPercentage:', locationPercentage);
          }
        } catch (err) {
          devLog('⚠️ Error calling percentageFromCfi:', err);
        }
      }

      // Method 2: Use epub.js built-in percentage (available after locations)
      if (progressPercent === null && location.start.percentage !== undefined) {
        const builtInPercentage = location.start.percentage;
        if (
          typeof builtInPercentage === 'number' &&
          !Number.isNaN(builtInPercentage) &&
          builtInPercentage >= 0 &&
          builtInPercentage <= 1
        ) {
          progressPercent = Math.round(builtInPercentage * 100);
          devLog('Progress from built-in percentage:', progressPercent + '%');
        }
      }

      // Method 3: Calculate from spine index (fallback before locations ready)
      if (progressPercent === null) {
        const spineIndex = location.start.index;
        const displayedPage = location.start.displayed?.page || 1;
        const displayedTotal = location.start.displayed?.total || 1;
        const totalSpineItems = book?.spine?.items?.length || book?.spine?.length || 0;

        devLog('Spine fallback calculation:', {
          spineIndex,
          totalSpineItems,
          displayedPage,
          displayedTotal,
        });

        if (totalSpineItems > 0 && spineIndex !== undefined && spineIndex >= 0) {
          const withinSectionProgress = displayedPage / displayedTotal;
          const spineProgress = ((spineIndex + withinSectionProgress) / totalSpineItems) * 100;
          progressPercent = Math.min(100, Math.max(0, Math.round(spineProgress * 10) / 10));
          devLog('Progress from spine:', progressPercent + '%');
        }
      }

      // Final validation and state update
      if (progressPercent !== null && !Number.isNaN(progressPercent)) {
        progressPercent = Math.min(100, Math.max(0, progressPercent));
        setProgress(progressPercent);
        setProgressValid(true); // Mark progress as valid
        devLog('✅ Progress calculated successfully:', progressPercent + '%');
      } else {
        devLog('⚠️ Could not calculate progress - keeping previous value, marking as invalid');
        // DON'T mark progressValid=false here - keep previous valid state
        // This allows saves with previously calculated progress to continue
      }

      // Calculate scroll offset
      const scrollOffset = calculateScrollOffset();
      setScrollOffsetPercent(scrollOffset);

      devLog('Final state update:', {
        cfi: cfi.substring(0, 50) + '...',
        progress: progressPercent !== null ? progressPercent + '%' : 'unchanged',
        scrollOffset: scrollOffset.toFixed(2) + '%',
        isRestorationEvent,
      });

      // Callback for external handling (e.g., save to backend)
      // SKIP on restoration to prevent re-saving the same position we just loaded
      if (onLocationChange && progressPercent !== null && !isRestorationEvent) {
        onLocationChange(cfi, progressPercent, scrollOffset);
      } else if (isRestorationEvent) {
        devLog('📌 Skipped save callback - restoration event');
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
        devLog('Page: Current page:', validPage, '/', locations.total);
      }

      return validPage;
    } catch (err) {
      devLog('Warning: Could not get page from CFI:', err);
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
    devLog('Total pages: Total pages available:', total);

    return total;
  }, [locations]);

  return {
    currentCFI,
    progress,
    progressValid,
    scrollOffsetPercent,
    currentPage,
    totalPages,
    goToCFI,
    skipNextRelocated,
    setInitialProgress,
  };
};
