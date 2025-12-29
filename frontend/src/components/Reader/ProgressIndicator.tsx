/**
 * ProgressIndicator - Visual reading progress indicator for EPUB reader
 *
 * Displays current progress, chapter, and page information.
 *
 * @component
 */

import React from 'react';
import type { ThemeName } from '@/hooks/epub';

interface ProgressIndicatorProps {
  progress: number; // 0-100
  currentChapter: number;
  totalChapters?: number;
  currentPage?: number;
  totalPages?: number;
  theme: ThemeName;
  isVisible?: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  currentChapter,
  totalChapters,
  currentPage,
  totalPages,
  theme,
  isVisible = true,
}) => {
  if (!isVisible) return null;

  // Theme-based colors
  const getColors = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-white/90',
          text: 'text-gray-800',
          subtext: 'text-gray-600',
          progress: 'bg-blue-500',
          progressBg: 'bg-gray-200',
          border: 'border-gray-200',
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50/90',
          text: 'text-amber-900',
          subtext: 'text-amber-700',
          progress: 'bg-amber-600',
          progressBg: 'bg-amber-200',
          border: 'border-amber-200',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800/90',
          text: 'text-gray-100',
          subtext: 'text-gray-400',
          progress: 'bg-blue-500',
          progressBg: 'bg-gray-700',
          border: 'border-gray-600',
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 ${colors.bg} backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border ${colors.border}`}>
      <div className="flex items-center gap-2 sm:gap-4 min-w-[140px] sm:min-w-[200px]">
        {/* Progress percentage */}
        <div className={`text-sm font-medium tabular-nums ${colors.text}`}>
          {progress < 10 ? progress.toFixed(1) : Math.round(progress)}%
        </div>

        {/* Progress bar */}
        <div className="flex-1">
          <div className={`h-2 ${colors.progressBg} rounded-full overflow-hidden`}>
            <div
              className={`h-full ${colors.progress} transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Chapter/Page info */}
        <div className={`text-xs ${colors.subtext} flex items-center gap-2`}>
          {totalChapters && (
            <span>
              Гл. {currentChapter}/{totalChapters}
            </span>
          )}
          {!totalChapters && (
            <span>Глава {currentChapter}</span>
          )}
          {totalPages && currentPage && (
            <>
              <span>•</span>
              <span>
                Стр. {currentPage}/{totalPages}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
