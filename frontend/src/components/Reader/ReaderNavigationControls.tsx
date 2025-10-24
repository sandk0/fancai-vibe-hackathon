/**
 * ReaderNavigationControls - Navigation controls and progress bar
 *
 * Displays previous/next buttons, chapter selector, and reading progress.
 *
 * @component
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { BookDetail } from '@/types/api';

interface ReaderNavigationControlsProps {
  book: BookDetail;
  currentChapter: number;
  currentPage: number;
  totalPages: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToChapter: (chapterNum: number) => void;
}

export const ReaderNavigationControls: React.FC<ReaderNavigationControlsProps> = React.memo(({
  book,
  currentChapter,
  currentPage,
  totalPages,
  canGoPrev,
  canGoNext,
  onPrevPage,
  onNextPage,
  onJumpToChapter,
}) => {
  const { t } = useTranslation();

  const totalChapters = book.chapters?.length || book.chapters_count || 0;

  // Calculate overall progress
  const overallProgress = totalPages > 0
    ? Math.round(((currentChapter - 1) + currentPage / totalPages) / totalChapters * 100)
    : 0;

  return (
    <div className="mt-8">
      {/* Navigation Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={onPrevPage}
          disabled={!canGoPrev}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('reader.previous')}
        >
          <ChevronLeft className="h-5 w-5" />
          <span>{t('reader.previous')}</span>
        </button>

        <div className="flex items-center space-x-4">
          <select
            value={currentChapter}
            onChange={(e) => onJumpToChapter(parseInt(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
            aria-label="Select chapter"
          >
            {Array.from({ length: totalChapters }, (_, i) => i + 1).map(num => (
              <option key={num} value={num}>
                {t('reader.chapterLabel')} {num}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onNextPage}
          disabled={!canGoNext}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label={t('reader.next')}
        >
          <span>{t('reader.next')}</span>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span>{t('reader.progress')}</span>
          <span>{overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(overallProgress, 100)}%`
            }}
            role="progressbar"
            aria-valuenow={overallProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  );
});

ReaderNavigationControls.displayName = 'ReaderNavigationControls';
