/**
 * ReaderSettingsPanel - Reader settings panel component
 *
 * Quick settings for font size, theme, etc.
 *
 * @component
 */

import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';

interface ReaderSettingsPanelProps {
  fontSize: number;
  theme: 'light' | 'dark' | 'sepia';
  onFontSizeChange: (size: number) => void;
  onThemeChange: (theme: 'light' | 'dark' | 'sepia') => void;
}

export const ReaderSettingsPanel: React.FC<ReaderSettingsPanelProps> = React.memo(({
  fontSize,
  theme,
  onFontSizeChange,
  onThemeChange,
}) => {
  const { t } = useTranslation();

  return (
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
                aria-label="Decrease font size"
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
                aria-label="Font size"
              />
              <button
                onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))}
                className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                aria-label="Increase font size"
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
                  aria-label={`${themeOption} theme`}
                  aria-pressed={theme === themeOption}
                >
                  {t(`readerSettings.${themeOption}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ReaderSettingsPanel.displayName = 'ReaderSettingsPanel';
