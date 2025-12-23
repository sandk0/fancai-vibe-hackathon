/**
 * ReaderControls - Settings dropdown menu
 *
 * Features:
 * - Theme switcher (Light/Dark/Sepia)
 * - Font size controls (A-/A+)
 * - Fully theme-aware styling
 *
 * @component
 */

import React from 'react';
import {
  Sun,
  Moon,
  FileText,
  Minus,
  Plus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/UI/dropdown-menu';
import { cn } from '@/lib/utils';
import type { ThemeName } from '@/hooks/epub/useEpubThemes';

interface ReaderControlsProps {
  theme: ThemeName;
  fontSize: number;
  onThemeChange: (theme: ThemeName) => void;
  onFontSizeIncrease: () => void;
  onFontSizeDecrease: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export const ReaderControls: React.FC<ReaderControlsProps> = ({
  theme,
  fontSize,
  onThemeChange,
  onFontSizeIncrease,
  onFontSizeDecrease,
  isOpen,
  onOpenChange,
  className,
}) => {

  // Theme-aware colors
  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          fabBg: 'bg-blue-500 hover:bg-blue-600',
          fabText: 'text-white',
          menuBg: 'bg-white/95',
          text: 'text-gray-900',
          textSecondary: 'text-gray-600',
          border: 'border-gray-200',
          hover: 'hover:bg-gray-100',
          buttonActive: 'bg-blue-500 text-white',
          buttonInactive: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
        };
      case 'sepia':
        return {
          fabBg: 'bg-amber-600 hover:bg-amber-700',
          fabText: 'text-white',
          menuBg: 'bg-amber-50/95',
          text: 'text-amber-900',
          textSecondary: 'text-amber-700',
          border: 'border-amber-200',
          hover: 'hover:bg-amber-100',
          buttonActive: 'bg-amber-600 text-white',
          buttonInactive: 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100',
        };
      case 'dark':
      default:
        return {
          fabBg: 'bg-blue-600 hover:bg-blue-700',
          fabText: 'text-white',
          menuBg: 'bg-gray-800/95',
          text: 'text-gray-100',
          textSecondary: 'text-gray-400',
          border: 'border-gray-600',
          hover: 'hover:bg-gray-700',
          buttonActive: 'bg-blue-600 text-white',
          buttonInactive: 'bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600',
        };
    }
  };

  const colors = getThemeColors();

  return (
    <div className={className}>
      <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <div />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className={cn(
            "w-[calc(100vw-2rem)] sm:w-80 max-w-80 backdrop-blur-md border p-0",
            colors.menuBg,
            colors.border
          )}
        >
          {/* Header */}
          <div className={cn("px-4 py-3 border-b", colors.border)}>
            <h3 className={cn("font-semibold", colors.text)}>Настройки читалки</h3>
          </div>

          {/* Theme Switcher */}
          <div className="px-4 py-3">
            <label className={cn("text-xs font-medium mb-2 block", colors.textSecondary)}>
              Тема оформления
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onThemeChange('light')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  theme === 'light' ? colors.buttonActive : colors.buttonInactive
                )}
              >
                <Sun className="h-4 w-4" />
                Светлая
              </button>
              <button
                onClick={() => onThemeChange('dark')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  theme === 'dark' ? colors.buttonActive : colors.buttonInactive
                )}
              >
                <Moon className="h-4 w-4" />
                Тёмная
              </button>
              <button
                onClick={() => onThemeChange('sepia')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  theme === 'sepia' ? colors.buttonActive : colors.buttonInactive
                )}
              >
                <FileText className="h-4 w-4" />
                Сепия
              </button>
            </div>
          </div>

          <div className={cn("border-t", colors.border)} />

          {/* Font Size Controls */}
          <div className="px-4 py-3">
            <label className={cn("text-xs font-medium mb-2 block", colors.textSecondary)}>
              Размер шрифта
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={onFontSizeDecrease}
                disabled={fontSize <= 75}
                className={cn(
                  "h-9 w-9 rounded-md flex items-center justify-center transition-colors",
                  colors.buttonInactive,
                  fontSize <= 75 && "opacity-40 cursor-not-allowed"
                )}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 text-center">
                <span className={cn("text-lg font-semibold", colors.text)}>{fontSize}%</span>
              </div>
              <button
                onClick={onFontSizeIncrease}
                disabled={fontSize >= 200}
                className={cn(
                  "h-9 w-9 rounded-md flex items-center justify-center transition-colors",
                  colors.buttonInactive,
                  fontSize >= 200 && "opacity-40 cursor-not-allowed"
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
