/**
 * AdminMultiNLPSettings - Настройки Multi-NLP системы
 *
 * Управляет настройками:
 * - Глобальные NLP настройки (режим обработки, процессор по умолчанию)
 * - SpaCy настройки (модель, веса, пороги)
 * - Natasha настройки (морфология, синтаксис, NER)
 * - Stanza настройки
 *
 * @param settings - Текущие настройки Multi-NLP
 * @param setSettings - Функция обновления настроек
 * @param isLoading - Индикатор загрузки
 * @param onSave - Callback при сохранении
 * @param isSaving - Индикатор сохранения
 * @param t - Функция перевода
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Cpu, Save, RefreshCw } from 'lucide-react';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import type { MultiNLPSettings } from '@/api/admin';

interface AdminMultiNLPSettingsProps {
  settings: MultiNLPSettings | null;
  setSettings: (settings: MultiNLPSettings) => void;
  isLoading: boolean;
  onSave: (settings: MultiNLPSettings) => void;
  isSaving: boolean;
  t: (key: string) => string;
}

export const AdminMultiNLPSettings: React.FC<AdminMultiNLPSettingsProps> = ({
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
        <LoadingSpinner size="lg" text={t('admin.loadingMultiNlp')} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global NLP Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <Cpu className="w-5 h-5" />
          {t('admin.globalNlpConfig')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Processing Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.processingMode')}
            </label>
            <select
              value={settings.processing_mode}
              onChange={(e) => setSettings({ ...settings, processing_mode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="single">{t('admin.processingModeSingle')}</option>
              <option value="parallel">{t('admin.processingModeParallel')}</option>
              <option value="sequential">{t('admin.processingModeSequential')}</option>
              <option value="ensemble">{t('admin.processingModeEnsemble')}</option>
              <option value="adaptive">{t('admin.processingModeAdaptive')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.processingModeHint')}
            </p>
          </div>

          {/* Default Processor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.defaultProcessor')}
            </label>
            <select
              value={settings.default_processor}
              onChange={(e) => setSettings({ ...settings, default_processor: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {settings.available_processors.map(processor => (
                <option key={processor} value={processor}>
                  {processor === 'spacy' ? 'spaCy' :
                   processor === 'natasha' ? 'Natasha' :
                   processor === 'stanza' ? 'Stanza' : processor}
                </option>
              ))}
            </select>
          </div>

          {/* Ensemble Voting Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.ensembleThreshold')}
            </label>
            <input
              type="number"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.ensemble_voting_threshold}
              onChange={(e) => setSettings({ ...settings, ensemble_voting_threshold: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.ensembleThresholdHint')}
            </p>
          </div>
        </div>
      </div>

      {/* SpaCy Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${settings.spacy_settings.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          {t('admin.spacySettings')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.spacy_settings.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  spacy_settings: { ...settings.spacy_settings, enabled: e.target.checked }
                })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.enableSpacy')}</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.model')}
            </label>
            <select
              value={settings.spacy_settings.model_name}
              onChange={(e) => setSettings({
                ...settings,
                spacy_settings: { ...settings.spacy_settings, model_name: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.spacy_settings.enabled}
            >
              {settings.available_spacy_models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.confidenceThreshold')}
            </label>
            <input
              type="number"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.spacy_settings.confidence_threshold}
              onChange={(e) => setSettings({
                ...settings,
                spacy_settings: { ...settings.spacy_settings, confidence_threshold: parseFloat(e.target.value) }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.spacy_settings.enabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.weight')}
            </label>
            <input
              type="number"
              min="0.1"
              max="5.0"
              step="0.1"
              value={settings.spacy_settings.weight}
              onChange={(e) => setSettings({
                ...settings,
                spacy_settings: { ...settings.spacy_settings, weight: parseFloat(e.target.value) }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.spacy_settings.enabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.characterDetectionBoost')}
            </label>
            <input
              type="number"
              min="0.5"
              max="3.0"
              step="0.1"
              value={settings.spacy_settings.character_detection_boost}
              onChange={(e) => setSettings({
                ...settings,
                spacy_settings: { ...settings.spacy_settings, character_detection_boost: parseFloat(e.target.value) }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.spacy_settings.enabled}
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.spacy_settings.literary_patterns}
                onChange={(e) => setSettings({
                  ...settings,
                  spacy_settings: { ...settings.spacy_settings, literary_patterns: e.target.checked }
                })}
                className="rounded border-gray-300 dark:border-gray-600"
                disabled={!settings.spacy_settings.enabled}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.literaryPatterns')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Natasha Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${settings.natasha_settings.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          {t('admin.natashaSettings')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.natasha_settings.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  natasha_settings: { ...settings.natasha_settings, enabled: e.target.checked }
                })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.enableNatasha')}</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.confidenceThreshold')}
            </label>
            <input
              type="number"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.natasha_settings.confidence_threshold}
              onChange={(e) => setSettings({
                ...settings,
                natasha_settings: { ...settings.natasha_settings, confidence_threshold: parseFloat(e.target.value) }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.natasha_settings.enabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.literaryBoost')}
            </label>
            <input
              type="number"
              min="0.5"
              max="3.0"
              step="0.1"
              value={settings.natasha_settings.literary_boost}
              onChange={(e) => setSettings({
                ...settings,
                natasha_settings: { ...settings.natasha_settings, literary_boost: parseFloat(e.target.value) }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.natasha_settings.enabled}
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.natasha_settings.enable_morphology}
                onChange={(e) => setSettings({
                  ...settings,
                  natasha_settings: { ...settings.natasha_settings, enable_morphology: e.target.checked }
                })}
                className="rounded border-gray-300 dark:border-gray-600"
                disabled={!settings.natasha_settings.enabled}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.morphologyAnalysis')}</span>
            </label>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.natasha_settings.enable_syntax}
                onChange={(e) => setSettings({
                  ...settings,
                  natasha_settings: { ...settings.natasha_settings, enable_syntax: e.target.checked }
                })}
                className="rounded border-gray-300 dark:border-gray-600"
                disabled={!settings.natasha_settings.enabled}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.syntaxAnalysis')}</span>
            </label>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.natasha_settings.enable_ner}
                onChange={(e) => setSettings({
                  ...settings,
                  natasha_settings: { ...settings.natasha_settings, enable_ner: e.target.checked }
                })}
                className="rounded border-gray-300 dark:border-gray-600"
                disabled={!settings.natasha_settings.enabled}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.namedEntityRecognition')}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Stanza Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${settings.stanza_settings.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
          {t('admin.stanzaSettings')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.stanza_settings.enabled}
                onChange={(e) => setSettings({
                  ...settings,
                  stanza_settings: { ...settings.stanza_settings, enabled: e.target.checked }
                })}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('admin.enableStanza')}</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.confidenceThreshold')}
            </label>
            <input
              type="number"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.stanza_settings.confidence_threshold}
              onChange={(e) => setSettings({
                ...settings,
                stanza_settings: { ...settings.stanza_settings, confidence_threshold: parseFloat(e.target.value) }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.stanza_settings.enabled}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('admin.weight')}
            </label>
            <input
              type="number"
              min="0.1"
              max="5.0"
              step="0.1"
              value={settings.stanza_settings.weight}
              onChange={(e) => setSettings({
                ...settings,
                stanza_settings: { ...settings.stanza_settings, weight: parseFloat(e.target.value) }
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              disabled={!settings.stanza_settings.enabled}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={() => onSave(settings)}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isSaving ? t('admin.saving') : t('admin.saveMultiNlpSettings')}
        </button>
      </div>
    </div>
  );
};
