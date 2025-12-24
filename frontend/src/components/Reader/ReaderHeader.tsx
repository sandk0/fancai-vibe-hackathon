/**
 * ReaderHeader - Theme-aware header with navigation, progress, and controls
 *
 * Features:
 * - Back button with navigation
 * - Book title and author
 * - TOC button (icon only)
 * - Book Info button (icon only)
 * - Compact progress bar with page counter
 * - Settings button
 * - Fully theme-aware (Light/Dark/Sepia)
 *
 * @component
 */

import React from 'react';
import { ArrowLeft, List, Info, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/hooks/epub/useEpubThemes';

interface ReaderHeaderProps {
  title: string;
  author: string;
  theme: ThemeName;
  progress: number;
  currentPage?: number;
  totalPages?: number;
  onBack: () => void;
  onTocToggle: () => void;
  onInfoOpen: () => void;
  onSettingsOpen: () => void;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = ({
  title,
  author,
  theme,
  progress,
  currentPage,
  totalPages,
  onBack,
  onTocToggle,
  onInfoOpen,
  onSettingsOpen,
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
          buttonBg: 'bg-gray-100',
          buttonHover: 'hover:bg-gray-200',
          buttonText: 'text-gray-900',
          progressBg: 'bg-gray-200',
          progressFill: 'bg-blue-500',
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50/95',
          text: 'text-amber-900',
          textSecondary: 'text-amber-700',
          border: 'border-amber-200',
          buttonBg: 'bg-amber-100',
          buttonHover: 'hover:bg-amber-200',
          buttonText: 'text-amber-900',
          progressBg: 'bg-amber-200',
          progressFill: 'bg-amber-600',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800/95',
          text: 'text-gray-100',
          textSecondary: 'text-gray-400',
          border: 'border-gray-700',
          buttonBg: 'bg-gray-700',
          buttonHover: 'hover:bg-gray-600',
          buttonText: 'text-gray-100',
          progressBg: 'bg-gray-700',
          progressFill: 'bg-blue-400',
        };
    }
  };

  const colors = getThemeColors();

  return (
    <div
      className={cn(
        'absolute left-0 right-0 z-10 backdrop-blur-md border-b',
        colors.bg,
        colors.border
      )}
      style={{ top: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        {/* Left: Back button + TOC + Book Info */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
              colors.buttonBg,
              colors.buttonHover,
              colors.buttonText
            )}
            title="Назад к книге"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Назад к книге</span>
          </button>

          <button
            onClick={onTocToggle}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-lg transition-colors',
              colors.buttonBg,
              colors.buttonHover,
              colors.buttonText
            )}
            title="Содержание"
          >
            <List className="w-5 h-5" />
          </button>

          <button
            onClick={onInfoOpen}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-lg transition-colors',
              colors.buttonBg,
              colors.buttonHover,
              colors.buttonText
            )}
            title="О книге"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* Center: Book title and author - hidden on mobile */}
        <div className="hidden md:block flex-1 px-2 text-center min-w-0">
          <h1 className={cn('text-lg font-semibold truncate', colors.text)}>
            {title}
          </h1>
          <p className={cn('text-sm truncate', colors.textSecondary)}>
            {author}
          </p>
        </div>

        {/* Right: Compact Progress + Settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Compact Progress Bar */}
          <div className="flex flex-col items-end gap-1 min-w-[80px] sm:min-w-[140px]">
            {/* Progress Info - Above the bar */}
            <div className={cn('flex items-center gap-1 sm:gap-2 text-xs', colors.textSecondary)}>
              {currentPage !== undefined && totalPages !== undefined && (
                <span className="font-medium hidden xs:inline">
                  {currentPage}/{totalPages}
                </span>
              )}
              <span className={cn('font-semibold', colors.text)}>
                {Math.round(progress)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className={cn('w-full h-1.5 rounded-full overflow-hidden', colors.progressBg)}>
              <div
                className={cn('h-full transition-all duration-300 rounded-full', colors.progressFill)}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>

          {/* Settings Button */}
          <button
            onClick={onSettingsOpen}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-lg transition-colors',
              colors.buttonBg,
              colors.buttonHover,
              colors.buttonText
            )}
            title="Настройки"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
