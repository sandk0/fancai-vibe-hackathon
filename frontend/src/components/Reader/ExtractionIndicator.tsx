/**
 * ExtractionIndicator - Prominent UI indicator for LLM description extraction
 *
 * Shows a visible indicator when AI is analyzing the chapter.
 * Includes animated spinner, explanatory text, and cancel button.
 *
 * FIXED (2025-12-25): Created as part of position restoration optimization
 * to provide clear feedback during 5-15 second LLM extraction.
 *
 * @component
 */

import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/hooks/epub/useEpubThemes';

interface ExtractionIndicatorProps {
  isExtracting: boolean;
  onCancel?: () => void;
  theme: ThemeName;
}

export const ExtractionIndicator: React.FC<ExtractionIndicatorProps> = ({
  isExtracting,
  onCancel,
  theme,
}) => {
  if (!isExtracting) return null;

  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-white/95',
          text: 'text-gray-900',
          textSecondary: 'text-gray-600',
          border: 'border-gray-200',
          buttonBg: 'bg-gray-100',
          buttonHover: 'hover:bg-gray-200',
          buttonText: 'text-gray-700',
          spinnerBorder: 'border-blue-500/30',
          spinnerFill: 'border-blue-500',
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50/95',
          text: 'text-amber-900',
          textSecondary: 'text-amber-700',
          border: 'border-amber-200',
          buttonBg: 'bg-amber-100',
          buttonHover: 'hover:bg-amber-200',
          buttonText: 'text-amber-800',
          spinnerBorder: 'border-amber-500/30',
          spinnerFill: 'border-amber-600',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800/95',
          text: 'text-white',
          textSecondary: 'text-gray-400',
          border: 'border-gray-700',
          buttonBg: 'bg-gray-700',
          buttonHover: 'hover:bg-gray-600',
          buttonText: 'text-gray-300',
          spinnerBorder: 'border-blue-400/30',
          spinnerFill: 'border-blue-400',
        };
    }
  };

  const colors = getThemeColors();

  return (
    <div
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-50',
        'px-5 py-4 rounded-2xl shadow-xl backdrop-blur-md',
        'flex items-center gap-4',
        'border',
        'animate-in fade-in slide-in-from-top-4 duration-300',
        colors.bg,
        colors.border
      )}
      style={{
        top: 'calc(80px + env(safe-area-inset-top))',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      {/* Animated Spinner */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            'w-10 h-10 rounded-full border-[3px]',
            colors.spinnerBorder
          )}
        />
        <div
          className={cn(
            'absolute inset-0 w-10 h-10 rounded-full border-[3px] border-t-transparent animate-spin',
            colors.spinnerFill
          )}
        />
        <Sparkles
          className={cn(
            'absolute inset-0 m-auto w-4 h-4',
            colors.textSecondary
          )}
        />
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium text-sm sm:text-base', colors.text)}>
          AI анализирует главу...
        </p>
        <p className={cn('text-xs sm:text-sm', colors.textSecondary)}>
          Обычно занимает 5-15 секунд
        </p>
      </div>

      {/* Cancel Button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className={cn(
            'flex-shrink-0 p-2 rounded-lg transition-colors',
            colors.buttonBg,
            colors.buttonHover,
            colors.buttonText
          )}
          title="Отменить"
          aria-label="Отменить анализ"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
