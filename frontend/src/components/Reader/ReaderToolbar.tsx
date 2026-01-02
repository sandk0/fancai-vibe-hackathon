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

interface ReaderToolbarProps {
  progress: number;
  currentPage?: number;
  totalPages?: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  className?: string;
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  progress,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  className,
}) => {
  return (
    <div
      className={cn(
        "fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-card/95 border-border",
        "backdrop-blur-md border",
        "rounded-full shadow-2xl px-3 sm:px-6 py-2.5 sm:py-3.5",
        "flex items-center gap-2 sm:gap-4",
        "transition-all duration-300",
        className
      )}
    >
      {/* Previous Button */}
      <button
        onClick={onPrevPage}
        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-colors text-foreground hover:bg-muted"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>

      {/* Progress Section */}
      <div className="flex flex-col items-center gap-1.5 sm:gap-2 min-w-[160px] sm:min-w-[240px]">
        {/* Progress Bar */}
        <div className="w-full h-1.5 sm:h-2 rounded-full overflow-hidden bg-muted">
          <div
            className="h-full transition-all duration-300 rounded-full bg-primary"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        {/* Page Info */}
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-muted-foreground">
          {currentPage !== undefined && totalPages !== undefined ? (
            <span className="font-medium">
              Страница {currentPage} / {totalPages}
            </span>
          ) : null}
          <span className="font-semibold tabular-nums text-foreground">
            {progress < 10 ? progress.toFixed(1) : Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Next Button */}
      <button
        onClick={onNextPage}
        className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-colors text-foreground hover:bg-muted"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
      </button>
    </div>
  );
};
