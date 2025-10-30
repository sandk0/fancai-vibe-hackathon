/**
 * ReaderToolbar - Modern floating toolbar for book navigation
 *
 * Features:
 * - Compact bottom-centered design
 * - Navigation arrows (prev/next page)
 * - Progress bar with percentage
 * - Page counter
 * - Theme-aware styling (Light/Dark/Sepia)
 * - Smooth animations
 *
 * @component
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/hooks/epub/useEpubThemes';

interface ReaderToolbarProps {
  progress: number;
  currentPage?: number;
  totalPages?: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  theme: ThemeName;
  className?: string;
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  progress,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  theme,
  className,
}) => {
  // Theme-aware colors
  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-white/95',
          text: 'text-gray-900',
          textSecondary: 'text-gray-600',
          border: 'border-gray-200',
          hover: 'hover:bg-gray-100',
          progressBg: 'bg-gray-200',
          progressFill: 'bg-blue-500',
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50/95',
          text: 'text-amber-900',
          textSecondary: 'text-amber-700',
          border: 'border-amber-200',
          hover: 'hover:bg-amber-100',
          progressBg: 'bg-amber-200',
          progressFill: 'bg-amber-600',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800/95',
          text: 'text-gray-100',
          textSecondary: 'text-gray-400',
          border: 'border-gray-600',
          hover: 'hover:bg-gray-700',
          progressBg: 'bg-gray-700',
          progressFill: 'bg-blue-400',
        };
    }
  };

  const colors = getThemeColors();

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        colors.bg,
        colors.border,
        "backdrop-blur-md border",
        "rounded-full shadow-2xl px-6 py-3.5",
        "flex items-center gap-4",
        "transition-all duration-300",
        className
      )}
    >
      {/* Previous Button */}
      <button
        onClick={onPrevPage}
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
          colors.text,
          colors.hover
        )}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Progress Section */}
      <div className="flex flex-col items-center gap-2 min-w-[240px]">
        {/* Progress Bar */}
        <div className={cn("w-full h-2 rounded-full overflow-hidden", colors.progressBg)}>
          <div
            className={cn("h-full transition-all duration-300 rounded-full", colors.progressFill)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        {/* Page Info */}
        <div className={cn("flex items-center gap-3 text-xs", colors.textSecondary)}>
          {currentPage !== undefined && totalPages !== undefined ? (
            <span className="font-medium">
              Страница {currentPage} / {totalPages}
            </span>
          ) : null}
          <span className={cn("font-semibold", colors.text)}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Next Button */}
      <button
        onClick={onNextPage}
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
          colors.text,
          colors.hover
        )}
        aria-label="Next page"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
};
