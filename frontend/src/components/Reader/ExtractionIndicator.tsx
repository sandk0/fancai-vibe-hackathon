/**
 * ExtractionIndicator - Prominent UI indicator for LLM description extraction
 *
 * Shows a visible indicator when AI is analyzing the chapter.
 * Includes animated spinner, explanatory text, and cancel button.
 * Uses semantic CSS tokens for automatic theme support.
 *
 * FIXED (2025-12-25): Created as part of position restoration optimization
 * to provide clear feedback during 5-15 second LLM extraction.
 *
 * @component
 */

import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtractionIndicatorProps {
  isExtracting: boolean;
  onCancel?: () => void;
}

export const ExtractionIndicator: React.FC<ExtractionIndicatorProps> = ({
  isExtracting,
  onCancel,
}) => {
  if (!isExtracting) return null;

  return (
    <div
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-[800]',
        'top-20 mt-safe',
        'max-w-[calc(100vw-32px)]',
        'px-5 py-4 rounded-xl shadow-xl backdrop-blur-md',
        'flex items-center gap-4',
        'border border-border',
        'bg-popover/95',
        'animate-in fade-in slide-in-from-top-4 duration-300'
      )}
    >
      {/* Animated Spinner */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full border-[3px] border-primary/30" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-[3px] border-t-transparent border-primary animate-spin" />
        <Sparkles className="absolute inset-0 m-auto w-4 h-4 text-muted-foreground" />
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm sm:text-base text-popover-foreground">
          AI анализирует главу...
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Обычно занимает 5-15 секунд
        </p>
      </div>

      {/* Cancel Button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="flex-shrink-0 p-2 rounded-lg transition-colors bg-muted hover:bg-muted/80 text-muted-foreground"
          title="Отменить"
          aria-label="Отменить анализ"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
