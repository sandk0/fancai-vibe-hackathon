/**
 * useChapterNavigation - Custom hook for chapter and page navigation
 *
 * Manages navigation between pages and chapters with boundary handling.
 *
 * @param currentChapter - Current chapter number
 * @param setCurrentChapter - Set chapter function
 * @param currentPage - Current page number
 * @param setCurrentPage - Set page function
 * @param totalPages - Total pages in current chapter
 * @param totalChapters - Total chapters in book
 * @returns Navigation functions
 *
 * @example
 * const { nextPage, prevPage, jumpToChapter } = useChapterNavigation(
 *   currentChapter,
 *   setCurrentChapter,
 *   currentPage,
 *   setCurrentPage,
 *   pages.length,
 *   book.chapters_count
 * );
 */

import { useCallback, useEffect } from 'react';

interface UseChapterNavigationOptions {
  currentChapter: number;
  setCurrentChapter: (chapter: number) => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  totalChapters: number;
}

interface UseChapterNavigationReturn {
  nextPage: () => void;
  prevPage: () => void;
  jumpToChapter: (chapterNum: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

export const useChapterNavigation = ({
  currentChapter,
  setCurrentChapter,
  currentPage,
  setCurrentPage,
  totalPages,
  totalChapters,
}: UseChapterNavigationOptions): UseChapterNavigationReturn => {

  const nextPage = useCallback(() => {
    console.log(`[useChapterNavigation] Next: page=${currentPage}, total=${totalPages}, chapter=${currentChapter}`);

    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
    } else if (currentChapter < totalChapters) {
      console.log('[useChapterNavigation] Moving to next chapter');
      setCurrentChapter(currentChapter + 1);
      setCurrentPage(1);
    }
  }, [currentPage, totalPages, currentChapter, totalChapters, setCurrentPage, setCurrentChapter]);

  const prevPage = useCallback(() => {
    console.log(`[useChapterNavigation] Prev: page=${currentPage}, total=${totalPages}, chapter=${currentChapter}`);

    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
    } else if (currentChapter > 1) {
      console.log('[useChapterNavigation] Moving to previous chapter');
      setCurrentChapter(currentChapter - 1);
      setCurrentPage(1);
    }
  }, [currentPage, currentChapter, setCurrentPage, setCurrentChapter]);

  const jumpToChapter = useCallback((chapterNum: number) => {
    if (chapterNum >= 1 && chapterNum <= totalChapters) {
      console.log(`[useChapterNavigation] Jumping to chapter ${chapterNum}`);
      setCurrentChapter(chapterNum);
      setCurrentPage(1);
    }
  }, [totalChapters, setCurrentChapter, setCurrentPage]);

  const canGoNext = currentPage < totalPages || currentChapter < totalChapters;
  const canGoPrev = currentPage > 1 || currentChapter > 1;

  return {
    nextPage,
    prevPage,
    jumpToChapter,
    canGoNext,
    canGoPrev,
  };
};

/**
 * useKeyboardNavigation - Keyboard shortcuts for navigation
 *
 * @param nextPage - Function to go to next page
 * @param prevPage - Function to go to previous page
 *
 * @example
 * useKeyboardNavigation(nextPage, prevPage);
 */
export const useKeyboardNavigation = (
  nextPage: () => void,
  prevPage: () => void
): void => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't intercept when typing in inputs
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ': // Spacebar
          e.preventDefault();
          nextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [nextPage, prevPage]);
};
