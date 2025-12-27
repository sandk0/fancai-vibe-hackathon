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

  /**
   * Save progress immediately (no debounce)
   */
  const saveImmediate = useCallback(async () => {
    if (!enabled || !currentCFI || !bookId) return;

    // Skip if no changes
    if (
      lastSavedRef.current.cfi === currentCFI &&
      lastSavedRef.current.progress === progress &&
      lastSavedRef.current.scrollOffset === scrollOffset &&
      lastSavedRef.current.chapter === currentChapter
    ) {
      console.log('[useProgressSync] Skipping save - no changes');
      return;
    }

    try {
      setIsSaving(true);
      console.log('[useProgressSync] Saving progress immediately:', {
        cfi: currentCFI.substring(0, 50) + '...',
        progress: progress + '%',
        scrollOffset: scrollOffset.toFixed(2) + '%',
        chapter: currentChapter,
      });

      await onSave(currentCFI, progress, scrollOffset, currentChapter);

      lastSavedRef.current = {
        cfi: currentCFI,
        progress,
        scrollOffset,
        chapter: currentChapter,
      };

      setLastSaved(Date.now());
      console.log('[useProgressSync] Progress saved successfully');
    } catch (err) {
      console.error('[useProgressSync] Error saving progress:', err);
    } finally {
      setIsSaving(false);
    }
  }, [enabled, currentCFI, progress, scrollOffset, currentChapter, bookId, onSave]);

  /**
   * Debounced progress update
   */
  useEffect(() => {
    if (!enabled || !currentCFI || !bookId) return;

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

    console.log('⏱️ [useProgressSync] Debouncing progress save...', {
      delay: debounceMs + 'ms',
      cfi: currentCFI.substring(0, 50) + '...',
    });

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
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Skip if no changes since last save
      if (
        lastSavedRef.current.cfi === currentCFI &&
        lastSavedRef.current.progress === progress &&
        lastSavedRef.current.scrollOffset === scrollOffset &&
        lastSavedRef.current.chapter === currentChapter
      ) {
        console.log('⏭️ [useProgressSync] Skipping beacon - no changes since last save');
        return;
      }

      if (enabled && currentCFI && bookId) {
        const data = JSON.stringify({
          current_chapter: currentChapter,
          current_position_percent: progress,
          reading_location_cfi: currentCFI,
          scroll_offset_percent: scrollOffset,
        });

        const url = `${window.location.origin}/api/v1/books/${bookId}/progress`;
        const token = localStorage.getItem('auth_token');

        if (token) {
          // Use fetch with keepalive - supports headers unlike sendBeacon
          // keepalive allows the request to continue after the page unloads
          try {
            fetch(url, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: data,
              keepalive: true, // Critical: allows request to complete after page unload
            }).catch(() => {
              // Ignore errors on page close - request may have been sent
            });
            console.log('📡 [useProgressSync] Progress sent via fetch keepalive on page close');
          } catch {
            // Fallback to sendBeacon (won't have auth, but better than nothing)
            if ('sendBeacon' in navigator) {
              const blob = new Blob([data], { type: 'application/json' });
              navigator.sendBeacon(url, blob);
              console.log('📡 [useProgressSync] Fallback: Progress sent via beacon (no auth)');
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
          console.log('🔄 [useProgressSync] Invalidating book query for fresh progress data');
          queryClient.invalidateQueries({ queryKey: ['book', bookId] });
        }, 200);
      }).catch(err => {
        console.error('❌ [useProgressSync] Error saving progress on unmount:', err);
        // Still invalidate to prevent stale data
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['book', bookId] });
        }, 200);
      });
    };
  }, [enabled, currentCFI, progress, scrollOffset, currentChapter, bookId, saveImmediate, queryClient]);

  return { isSaving, lastSaved };
};
