import React from 'react';
import { Type, Palette, Monitor, RotateCcw } from 'lucide-react';
import { useReaderStore } from '@/stores/reader';
import { useUIStore } from '@/stores/ui';
import { useTranslation } from '@/hooks/useTranslation';

const ReaderSettings: React.FC = () => {
  const {
    fontSize,
    fontFamily,
    lineHeight,
    theme,
    backgroundColor,
    textColor,
    maxWidth,
    margin,
    updateFontSize,
    updateFontFamily,
    updateLineHeight,
    updateTheme,
    resetSettings,
  } = useReaderStore();

  const { notify } = useUIStore();
  const { t } = useTranslation();

  const fontFamilyOptions = [
    { value: 'Georgia, serif', label: 'Georgia (Serif)', category: 'serif' },
    { value: 'Times New Roman, serif', label: 'Times New Roman', category: 'serif' },
    { value: 'Arial, sans-serif', label: 'Arial (Sans-serif)', category: 'sans-serif' },
    { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica', category: 'sans-serif' },
    { value: '"Open Sans", sans-serif', label: 'Open Sans', category: 'sans-serif' },
    { value: '"Courier New", monospace', label: 'Courier New (Mono)', category: 'monospace' },
  ];

  const themeOptions = [
    { value: 'light', label: t('readerSettings.light'), description: t('readerSettings.lightDesc') },
    { value: 'dark', label: t('readerSettings.dark'), description: t('readerSettings.darkDesc') },
    { value: 'sepia', label: t('readerSettings.sepia'), description: t('readerSettings.sepiaDesc') },
  ];

  const handleReset = () => {
    resetSettings();
    notify.success(t('readerSettings.settingsReset'), t('readerSettings.settingsResetDesc'));
  };

  return (
    <div className="space-y-8">
      {/* Font Settings */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Type className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('readerSettings.fontSettings')}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('readerSettings.fontSize')}: {fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="32"
              step="1"
              value={fontSize}
              onChange={(e) => updateFontSize(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>12px</span>
              <span>22px</span>
              <span>32px</span>
            </div>
          </div>

          {/* Line Height */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('readerSettings.lineHeight')}: {lineHeight.toFixed(1)}
            </label>
            <input
              type="range"
              min="1.2"
              max="2.5"
              step="0.1"
              value={lineHeight}
              onChange={(e) => updateLineHeight(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{t('readerSettings.tight')}</span>
              <span>{t('readerSettings.normal')}</span>
              <span>{t('readerSettings.loose')}</span>
            </div>
          </div>

          {/* Font Family */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('readerSettings.fontFamily')}
            </label>
            <select
              value={fontFamily}
              onChange={(e) => updateFontFamily(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <optgroup label={t('readerSettings.serifFonts')}>
                {fontFamilyOptions.filter(f => f.category === 'serif').map(font => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('readerSettings.sansSerifFonts')}>
                {fontFamilyOptions.filter(f => f.category === 'sans-serif').map(font => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('readerSettings.monospaceFonts')}>
                {fontFamilyOptions.filter(f => f.category === 'monospace').map(font => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Palette className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('readerSettings.themeSettings')}
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {themeOptions.map((themeOption) => (
            <div
              key={themeOption.value}
              className={`relative p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                theme === themeOption.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
              }`}
              onClick={() => updateTheme(themeOption.value as 'light' | 'dark' | 'sepia')}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg ${
                  themeOption.value === 'light' ? 'bg-white border-2 border-gray-300' :
                  themeOption.value === 'dark' ? 'bg-gray-800' :
                  'bg-yellow-100'
                }`} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {themeOption.label}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {themeOption.description}
                  </p>
                </div>
              </div>
              {theme === themeOption.value && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-primary-500 rounded-full" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Monitor className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t('readerSettings.preview')}
          </h3>
        </div>
        
        <div 
          className="p-6 border border-gray-300 dark:border-gray-600 rounded-lg"
          style={{
            backgroundColor: backgroundColor,
            color: textColor,
            fontFamily: fontFamily,
            fontSize: `${fontSize}px`,
            lineHeight: lineHeight,
            maxWidth: `${maxWidth}px`,
          }}
        >
          <p className="mb-4">
            <strong>{t('readerSettings.sampleText')}</strong>
          </p>
          <p className="mb-3">
            {t('readerSettings.sampleParagraph1')}
          </p>
          <p className="mb-3">
            {t('readerSettings.sampleQuote')}
          </p>
          <p>
            {t('readerSettings.sampleParagraph2')}
          </p>
        </div>
      </div>

      {/* Advanced Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {t('readerSettings.advancedSettings')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max Width */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('readerSettings.maxWidth')}: {maxWidth}px
            </label>
            <input
              type="range"
              min="600"
              max="1200"
              step="50"
              value={maxWidth}
              onChange={(e) => useReaderStore.setState({ maxWidth: Number(e.target.value) })}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{t('readerSettings.narrow')}</span>
              <span>{t('readerSettings.medium')}</span>
              <span>{t('readerSettings.wide')}</span>
            </div>
          </div>

          {/* Margin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('readerSettings.pageMargin')}: {margin}px
            </label>
            <input
              type="range"
              min="20"
              max="80"
              step="10"
              value={margin}
              onChange={(e) => useReaderStore.setState({ margin: Number(e.target.value) })}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{t('readerSettings.minimal')}</span>
              <span>{t('readerSettings.standard')}</span>
              <span>{t('readerSettings.spacious')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleReset}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('readerSettings.resetToDefaults')}
        </button>
      </div>

      {/* Custom CSS for slider styling */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        `
      }} />
    </div>
  );
};

export default ReaderSettings;