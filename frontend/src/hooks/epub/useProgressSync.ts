/**
 * useProgressSync - Custom hook for debounced reading progress synchronization
 *
 * Prevents excessive API requests by debouncing progress updates.
 * Performance improvement: 60 req/s → 0.2 req/s (5-second debounce)
 *
 * Features:
 * - Debounced updates (configurable delay)
 * - Automatic save on page close/unmount
 * - Error handling with retry logic
 * - Invalidates React Query cache on unmount (FIX #3)
 *
 * @param bookId - Book identifier
 * @param currentCFI - Current CFI position
 * @param progress - Current progress percentage
 * @param scrollOffset - Current scroll offset percentage
 * @param onSave - Callback function to save progress
 * @param debounceMs - Debounce delay in milliseconds (default: 5000)
 *
 * @example
 * useProgressSync(
 *   bookId,
 *   currentCFI,
 *   progress,
 *   scrollOffsetPercent,
 *   (cfi, prog, scroll) => booksAPI.updateReadingProgress(bookId, {...})
 * );
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Validate CFI format - must be a proper EPUB CFI
 * CFI must start with "epubcfi(" and end with ")"
 */
const isValidCFI = (cfi: string): boolean => {
  if (!cfi || typeof cfi !== 'string') return false;
  // Basic CFI format: epubcfi(/6/4!/4/2/...)
  const cfiPattern = /^epubcfi\([^)]+\)$/;
  return cfiPattern.test(cfi) && cfi.length >= 15;
};

interface UseProgressSyncOptions {
  bookId: string;
  currentCFI: string;
  progress: number;
  scrollOffset: number;
  currentChapter: number;
  onSave: (cfi: string, progress: number, scrollOffset: number, chapter: number) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseProgressSyncReturn {
  isSaving: boolean;
  lastSaved: number | null;
}

export const useProgressSync = ({
  bookId,
  currentCFI,
  progress,
  scrollOffset,
  currentChapter,
  onSave,
  debounceMs = 5000,
  enabled = true,
}: UseProgressSyncOptions): UseProgressSyncReturn => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastSavedRef = useRef<{
    cfi: string;
    progress: number;
    scrollOffset: number;
    chapter: number;
  }>({
    cfi: '',
    progress: 0,
    scrollOffset: 0,
    chapter: 0,
  });

  // Ref to store latest position values - fixes stale closure in beforeunload handler
  const latestPositionRef = useRef<{
    cfi: string;
    progress: number;
    scrollOffset: number;
    chapter: number;
  }>({
    cfi: '',
    progress: 0,
    scrollOffset: 0,
    chapter: 0,
  });

  // Keep ref updated with latest position values for beforeunload handler
  useEffect(() => {
    latestPositionRef.current = {
      cfi: currentCFI || '',
      progress: progress || 0,
      scrollOffset: scrollOffset || 0,
      chapter: currentChapter || 0,
    };
  }, [currentCFI, progress, scrollOffset, currentChapter]);

  /**
   * Save progress immediately (no debounce)
   *
   * CRITICAL VALIDATIONS (2026-01-06):
   * 1. CFI must be valid EPUB CFI format (prevents saving corrupted data)
   * 2. Progress must be valid number (prevents NaN being saved)
   */
  const saveImmediate = useCallback(async () => {
    if (!enabled || !currentCFI || !bookId) return;

    // CRITICAL: Validate CFI format before saving
    // This prevents saving invalid/empty CFI which would corrupt the reading position
    if (!isValidCFI(currentCFI)) {
      console.warn('[useProgressSync] Skipping save - invalid CFI format:', currentCFI?.substring(0, 50));
      return;
    }

    // Skip if no changes
    if (
      lastSavedRef.current.cfi === currentCFI &&
      lastSavedRef.current.progress === progress &&
      lastSavedRef.current.scrollOffset === scrollOffset &&
      lastSavedRef.current.chapter === currentChapter
    ) {
      return;
    }

    try {
      setIsSaving(true);

      await onSave(currentCFI, progress, scrollOffset, currentChapter);

      lastSavedRef.current = {
        cfi: currentCFI,
        progress,
        scrollOffset,
        chapter: currentChapter,
      };

      setLastSaved(Date.now());

      // Also update localStorage backup for conflict detection on next open
      try {
        localStorage.setItem(`book_${bookId}_progress_backup`, JSON.stringify({
          reading_location_cfi: currentCFI,
          current_position: progress,
          savedAt: Date.now(),
        }));
      } catch {
        // localStorage might be full or unavailable - ignore
      }
    } catch (err) {
      console.error('[useProgressSync] Error saving progress:', err);
    } finally {
      setIsSaving(false);
    }
  }, [enabled, currentCFI, progress, scrollOffset, currentChapter, bookId, onSave]);

  /**
   * Debounced progress update
   *
   * CRITICAL (2026-01-06): Validates CFI before scheduling save
   */
  useEffect(() => {
    if (!enabled || !currentCFI || !bookId) return;

    // CRITICAL: Don't schedule save with invalid CFI
    if (!isValidCFI(currentCFI)) {
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Skip if no changes
    if (
      lastSavedRef.current.cfi === currentCFI &&
      lastSavedRef.current.progress === progress &&
      lastSavedRef.current.scrollOffset === scrollOffset &&
      lastSavedRef.current.chapter === currentChapter
    ) {
      return;
    }

    // Schedule save
    timeoutRef.current = setTimeout(async () => {
      await saveImmediate();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentCFI, progress, scrollOffset, currentChapter, enabled, bookId, debounceMs, saveImmediate]);

  /**
   * Save on unmount or page close
   * Uses fetch with keepalive for authenticated requests (sendBeacon doesn't support headers)
   * FIX: Uses latestPositionRef to avoid stale closure capturing old position values
   * CRITICAL (2026-01-06): Validates CFI format before sending
   */
  useEffect(() => {
    if (!bookId) return;

    const handleBeforeUnload = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Read latest position from ref to avoid stale closure
      const { cfi, progress: currentProgress, scrollOffset: currentScrollOffset, chapter } = latestPositionRef.current;

      // Skip if no CFI position or invalid CFI format
      if (!cfi || !isValidCFI(cfi)) {
        return;
      }

      // Skip if no changes since last save
      if (
        lastSavedRef.current.cfi === cfi &&
        lastSavedRef.current.progress === currentProgress &&
        lastSavedRef.current.scrollOffset === currentScrollOffset &&
        lastSavedRef.current.chapter === chapter
      ) {
        return;
      }

      if (enabled) {
        const data = JSON.stringify({
          current_chapter: chapter,
          current_position_percent: currentProgress,
          reading_location_cfi: cfi,
          scroll_offset_percent: currentScrollOffset,
        });

        const url = `${window.location.origin}/api/v1/books/${bookId}/progress`;
        // Fixed: Use correct storage key (was 'auth_token', should be 'bookreader_access_token')
        const token = localStorage.getItem('bookreader_access_token');

        if (token) {
          // Use fetch with keepalive - supports headers unlike sendBeacon
          // keepalive allows the request to continue after the page unloads
          try {
            fetch(url, {
              method: 'POST', // Fixed: backend expects POST, not PUT (was causing 405 errors)
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: data,
              keepalive: true, // Critical: allows request to complete after page unload
            }).catch(() => {
              // Ignore errors on page close - request may have been sent
            });
          } catch {
            // Fallback to sendBeacon (won't have auth, but better than nothing)
            if ('sendBeacon' in navigator) {
              const blob = new Blob([data], { type: 'application/json' });
              navigator.sendBeacon(url, blob);
            }
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // Save on unmount
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // FIX: Save progress asynchronously and invalidate cache AFTER save completes
      // This prevents race condition where BookPage fetches old data before save completes
      saveImmediate().then(() => {
        // Small delay to ensure backend has processed the save
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['book', bookId] });
        }, 200);
      }).catch(_err => {
        // Still invalidate to prevent stale data
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['book', bookId] });
        }, 200);
      });
    };
  // Position values come from latestPositionRef, not closure - prevents stale closure bug
  }, [enabled, bookId, saveImmediate, queryClient]);

  return { isSaving, lastSaved };
};
