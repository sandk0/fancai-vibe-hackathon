/**
 * ReaderToolbar - Reader settings and controls toolbar
 *
 * Extracted from BookReader component for better separation of concerns.
 * Handles font size, theme, and navigation controls.
 *
 * @component
 */

import React from 'react';
import { BookOpen, Settings } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface ReaderToolbarProps {
  bookTitle: string;
  chapterTitle: string;
  currentChapter: number;
  currentPage: number;
  totalPages: number;
  showSettings: boolean;
  onToggleSettings: () => void;

  // Settings
  fontSize: number;
  theme: 'light' | 'dark' | 'sepia';
  onFontSizeChange: (size: number) => void;
  onThemeChange: (theme: 'light' | 'dark' | 'sepia') => void;
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({
  bookTitle,
  chapterTitle,
  currentChapter,
  currentPage,
  totalPages,
  showSettings,
  onToggleSettings,
  fontSize,
  theme,
  onFontSizeChange,
  onThemeChange,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-6 w-6 text-primary-600" />
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">
                {bookTitle}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('reader.chapterLabel')} {currentChapter}: {chapterTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('reader.page').replace('{num}', String(currentPage)).replace('{total}', String(totalPages))}
            </span>
            <button
              onClick={onToggleSettings}
              className={`p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ${
                showSettings ? 'bg-gray-100 dark:bg-gray-700 rounded' : ''
              }`}
              title={t('reader.settings')}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
              {t('reader.quickSettings')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('reader.fontSize')}: {fontSize}px
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))}
                    className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                  >
                    A-
                  </button>
                  <input
                    type="range"
                    min="12"
                    max="32"
                    step="2"
                    value={fontSize}
                    onChange={(e) => onFontSizeChange(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <button
                    onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))}
                    className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                  >
                    A+
                  </button>
                </div>
              </div>

              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('reader.theme')}
                </label>
                <div className="flex space-x-2">
                  {(['light', 'dark', 'sepia'] as const).map((themeOption) => (
                    <button
                      key={themeOption}
                      onClick={() => onThemeChange(themeOption)}
                      className={`flex-1 px-3 py-2 text-sm border rounded transition-colors ${
                        theme === themeOption
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t(`readerSettings.${themeOption}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
