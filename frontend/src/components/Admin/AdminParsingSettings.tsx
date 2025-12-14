/**
 * AdminParsingSettings - Настройки парсинга книг
 *
 * Управляет настройками:
 * - Максимальное количество одновременных задач парсинга
 * - Таймаут парсинга
 * - Приоритеты очереди для разных типов подписок
 *
 * @param settings - Текущие настройки парсинга
 * @param setSettings - Функция обновления настроек
 * @param isLoading - Индикатор загрузки
 * @param onSave - Callback при сохранении
 * @param isSaving - Индикатор сохранения
 * @param t - Функция перевода
 */

import React from 'react';
import { Save, RefreshCw } from 'lucide-react';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import type { ParsingSettings } from '@/api/admin';

interface AdminParsingSettingsProps {
  settings: ParsingSettings | null;
  setSettings: (settings: ParsingSettings) => void;
  isLoading: boolean;
  onSave: (settings: ParsingSettings) => void;
  isSaving: boolean;
  t: (key: string) => string;
}

export const AdminParsingSettings: React.FC<AdminParsingSettingsProps> = ({
  settings,
  setSettings,
  isLoading,
  onSave,
  isSaving,
  t
}) => {
  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" text={t('admin.loadingParsing')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          {t('admin.parsingConfig')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max Concurrent Parsing */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.maxConcurrentTasks')}
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.max_concurrent_parsing}
              onChange={(e) => setSettings({ ...settings, max_concurrent_parsing: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.timeoutMinutes')}
            </label>
            <input
              type="number"
              min="10"
              max="120"
              value={settings.timeout_minutes}
              onChange={(e) => setSettings({ ...settings, timeout_minutes: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Priority Weights */}
        <div className="mt-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">{t('admin.priorityWeights')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.freeUsers')}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.queue_priority_weights.free}
                onChange={(e) => setSettings({
                  ...settings,
                  queue_priority_weights: { ...settings.queue_priority_weights, free: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.premiumUsers')}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.queue_priority_weights.premium}
                onChange={(e) => setSettings({
                  ...settings,
                  queue_priority_weights: { ...settings.queue_priority_weights, premium: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('admin.ultimateUsers')}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.queue_priority_weights.ultimate}
                onChange={(e) => setSettings({
                  ...settings,
                  queue_priority_weights: { ...settings.queue_priority_weights, ultimate: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end mt-6">
          <button
            onClick={() => onSave(settings)}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? t('admin.saving') : t('admin.saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
};
