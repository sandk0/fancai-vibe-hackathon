/**
 * useReadingProgress - Custom hook for reading progress tracking
 *
 * Manages reading position restoration and auto-save functionality.
 * Prevents race conditions between restoration and navigation.
 *
 * @param bookId - Book identifier
 * @param currentChapter - Current chapter number
 * @param currentPage - Current page in chapter
 * @param totalPages - Total pages in current chapter
 * @returns Progress state and restoration status
 *
 * @example
 * const { hasRestoredPosition, restoreProgress } = useReadingProgress(
 *   bookId,
 *   currentChapter,
 *   currentPage,
 *   pages.length
 * );
 */

import { useState, useEffect, useCallback } from 'react';
import { booksAPI } from '@/api/books';

interface UseReadingProgressOptions {
  bookId: string;
  currentChapter: number;
  currentPage: number;
  totalPages: number;
  initialChapter: number;
  onPositionRestored?: (chapter: number, page: number) => void;
}

interface UseReadingProgressReturn {
  hasRestoredPosition: boolean;
  isRestoring: boolean;
  saveProgress: () => Promise<void>;
}

export const useReadingProgress = ({
  bookId,
  currentChapter,
  currentPage,
  totalPages,
  initialChapter,
  onPositionRestored,
}: UseReadingProgressOptions): UseReadingProgressReturn => {
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  /**
   * Restore reading position on initial load
   */
  useEffect(() => {
    console.log('📖 [useReadingProgress] Restore check:', {
      hasRestoredPosition,
      totalPages,
      currentChapter,
      initialChapter,
      willRestore: !hasRestoredPosition && totalPages > 0 && currentChapter === initialChapter
    });

    // Only restore once, for initial chapter, after pages are calculated
    if (hasRestoredPosition || totalPages === 0 || currentChapter !== initialChapter) {
      return;
    }

    console.log('📖 [useReadingProgress] Attempting to restore position...');
    setIsRestoring(true);

    booksAPI.getReadingProgress(bookId)
      .then(({ progress }) => {
        if (!progress) {
          console.log('📖 [useReadingProgress] No saved progress found');
          setHasRestoredPosition(true);
          setIsRestoring(false);
          return;
        }

        console.log('📖 [useReadingProgress] Loaded progress:', {
          currentChapter: progress.current_chapter,
          currentPosition: progress.current_position,
          savedChapter: progress.current_chapter,
          urlChapter: initialChapter,
          totalPages
        });

        // Only restore if on same chapter
        if (progress.current_chapter === currentChapter && progress.current_position > 0) {
          const targetPage = Math.max(1, Math.ceil((progress.current_position / 100) * totalPages));

          console.log('📖 [useReadingProgress] RESTORING:', {
            chapter: progress.current_chapter,
            positionPercent: progress.current_position + '%',
            totalPages,
            targetPage,
          });

          onPositionRestored?.(progress.current_chapter, targetPage);
        } else {
          console.log('📖 [useReadingProgress] NOT restoring - chapter mismatch');
        }

        setHasRestoredPosition(true);
        setIsRestoring(false);
      })
      .catch(err => {
        console.error('❌ [useReadingProgress] Failed to load progress:', err);
        setHasRestoredPosition(true);
        setIsRestoring(false);
      });
  }, [totalPages, currentChapter, initialChapter, bookId, hasRestoredPosition, onPositionRestored]);

  /**
   * Auto-save progress when position changes
   */
  useEffect(() => {
    // Don't save until position has been restored
    if (!hasRestoredPosition || totalPages === 0) {
      return;
    }

    const positionPercent = (currentPage / totalPages) * 100;

    console.log('📊 [useReadingProgress] Auto-save:', {
      currentChapter,
      currentPage,
      totalPages,
      positionPercent: positionPercent.toFixed(2) + '%'
    });

    booksAPI.updateReadingProgress(bookId, {
      current_chapter: currentChapter,
      current_position_percent: positionPercent
    })
      .then(() => {
        console.log('📊 [useReadingProgress] ✅ Progress saved');
      })
      .catch(err => {
        console.error('❌ [useReadingProgress] Failed to update:', err);
      });
  }, [bookId, currentChapter, currentPage, totalPages, hasRestoredPosition]);

  /**
   * Manual progress save (for chapter changes)
   */
  const saveProgress = useCallback(async () => {
    const positionPercent = (currentPage / totalPages) * 100;

    await booksAPI.updateReadingProgress(bookId, {
      current_chapter: currentChapter,
      current_position_percent: positionPercent
    });
  }, [bookId, currentChapter, currentPage, totalPages]);

  return {
    hasRestoredPosition,
    isRestoring,
    saveProgress,
  };
};
