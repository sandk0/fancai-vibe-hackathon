/**
 * ReaderControls - Settings dropdown menu
 *
 * Features:
 * - Theme switcher (Light/Dark/Sepia)
 * - Font size controls (A-/A+)
 * - Uses semantic Tailwind classes for consistent theming
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
  return (
    <div className={className}>
      <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <div />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-[calc(100vw-2rem)] sm:w-80 max-w-80 backdrop-blur-md border border-border bg-popover/95 p-0"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-popover-foreground">Настройки читалки</h3>
          </div>

          {/* Theme Switcher */}
          <div className="px-4 py-3">
            <label className="text-xs font-medium mb-2 block text-muted-foreground">
              Тема оформления
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onThemeChange('light')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  theme === 'light'
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border hover:bg-muted"
                )}
              >
                <Sun className="h-4 w-4" />
                Светлая
              </button>
              <button
                onClick={() => onThemeChange('dark')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  theme === 'dark'
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border hover:bg-muted"
                )}
              >
                <Moon className="h-4 w-4" />
                Тёмная
              </button>
              <button
                onClick={() => onThemeChange('sepia')}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-1.5",
                  theme === 'sepia'
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground border border-border hover:bg-muted"
                )}
              >
                <FileText className="h-4 w-4" />
                Сепия
              </button>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Font Size Controls */}
          <div className="px-4 py-3">
            <label className="text-xs font-medium mb-2 block text-muted-foreground">
              Размер шрифта
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={onFontSizeDecrease}
                disabled={fontSize <= 75}
                className={cn(
                  "h-11 w-11 min-h-[44px] min-w-[44px] rounded-md flex items-center justify-center transition-colors",
                  "bg-card text-foreground border border-border hover:bg-muted",
                  fontSize <= 75 && "opacity-40 cursor-not-allowed"
                )}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex-1 text-center">
                <span className="text-lg font-semibold text-popover-foreground">{fontSize}%</span>
              </div>
              <button
                onClick={onFontSizeIncrease}
                disabled={fontSize >= 200}
                className={cn(
                  "h-11 w-11 min-h-[44px] min-w-[44px] rounded-md flex items-center justify-center transition-colors",
                  "bg-card text-foreground border border-border hover:bg-muted",
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
