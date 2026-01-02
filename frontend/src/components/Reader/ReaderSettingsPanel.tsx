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
    <div className="bg-muted border-b border-border py-4 px-6">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-sm font-medium text-foreground mb-4">
          {t('reader.quickSettings')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              {t('reader.fontSize')}: {fontSize}px
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))}
                className="px-3 py-1 bg-card border border-border rounded hover:bg-muted text-sm text-foreground"
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
                className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                aria-label="Font size"
              />
              <button
                onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))}
                className="px-3 py-1 bg-card border border-border rounded hover:bg-muted text-sm text-foreground"
                aria-label="Increase font size"
              >
                A+
              </button>
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              {t('reader.theme')}
            </label>
            <div className="flex space-x-2">
              {(['light', 'dark', 'sepia'] as const).map((themeOption) => (
                <button
                  key={themeOption}
                  onClick={() => onThemeChange(themeOption)}
                  className={`flex-1 px-3 py-2 text-sm border rounded transition-colors ${
                    theme === themeOption
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:bg-muted text-foreground'
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
