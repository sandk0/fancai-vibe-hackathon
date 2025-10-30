/**
 * ThemeSwitcher - Global theme toggle component
 *
 * Features:
 * - Dropdown menu with Light/Dark/Sepia options
 * - Icons for each theme
 * - Persistent theme selection
 * - Compact and accessible design
 */

import React from 'react';
import { Sun, Moon, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTheme, type AppTheme } from '@/hooks/useTheme';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes: Array<{ value: AppTheme; label: string; icon: React.ReactNode }> = [
    { value: 'light', label: 'Светлая', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Тёмная', icon: <Moon className="w-4 h-4" /> },
    { value: 'sepia', label: 'Сепия', icon: <FileText className="w-4 h-4" /> },
  ];

  const currentTheme = themes.find(t => t.value === theme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
            "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
            "text-gray-900 dark:text-gray-100"
          )}
          title="Сменить тему"
        >
          {currentTheme?.icon}
          <span className="hidden sm:inline text-sm font-medium">{currentTheme?.label}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        {themes.map(({ value, label, icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              theme === value && "bg-blue-50 dark:bg-blue-900/20"
            )}
          >
            {icon}
            <span>{label}</span>
            {theme === value && <span className="ml-auto text-blue-600">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
