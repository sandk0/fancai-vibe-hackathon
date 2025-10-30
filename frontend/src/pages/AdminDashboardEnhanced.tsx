import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  BookOpen,
  Image,
  Activity,
  Database,
  Cpu,
  AlertTriangle,
  Save,
  RefreshCw,
  Server,
  Shield
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { notify } from '@/stores/ui';
import { useTranslation } from '@/hooks/useTranslation';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import {
  adminAPI,
  type SystemStats,
  type MultiNLPSettings,
  type ParsingSettings,
  type ImageGenerationSettings,
  type SystemSettings
} from '@/api/admin';

// Enhanced Multi-NLP Settings Component
interface MultiNLPSettingsTabProps {
  settings: MultiNLPSettings | null;
  setSettings: (settings: MultiNLPSettings) => void;
  isLoading: boolean;
  onSave: (settings: MultiNLPSettings) => void;
  isSaving: boolean;
}

const MultiNLPSettingsTab: React.FC<MultiNLPSettingsTabProps> = ({
  settings,
  setSettings,
  isLoading,
  onSave,
  isSaving
}) => {
  const { t } = useTranslation();

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

// Parsing Settings Component
interface ParsingSettingsTabProps {
  settings: ParsingSettings | null;
  setSettings: (settings: ParsingSettings) => void;
  isLoading: boolean;
  onSave: (settings: ParsingSettings) => void;
  isSaving: boolean;
}

const ParsingSettingsTab: React.FC<ParsingSettingsTabProps> = ({
  settings,
  setSettings,
  isLoading,
  onSave,
  isSaving
}) => {
  const { t } = useTranslation();

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

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, isLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'nlp' | 'parsing' | 'images' | 'system' | 'users'>('overview');
  const [multiNlpSettings, setMultiNlpSettings] = useState<MultiNLPSettings | null>(null);
  const [parsingSettings, setParsingSettings] = useState<ParsingSettings | null>(null);
  const [_imageSettings, setImageSettings] = useState<ImageGenerationSettings | null>(null);
  const [_systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  // Always call hooks regardless of user state
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminAPI.getSystemStats(),
    refetchInterval: 30000,
    enabled: !!(user && user.is_admin)
  });

  const { data: multiNlpData, isLoading: multiNlpLoading } = useQuery<MultiNLPSettings>({
    queryKey: ['admin', 'multi-nlp-settings'],
    queryFn: () => adminAPI.getMultiNLPSettings(),
    enabled: !!(user && user.is_admin)
  });

  const { data: parsingData, isLoading: parsingLoading } = useQuery<ParsingSettings>({
    queryKey: ['admin', 'parsing-settings'],
    queryFn: () => adminAPI.getParsingSettings(),
    enabled: !!(user && user.is_admin)
  });

  const { data: imageData, isLoading: _imageLoading } = useQuery<ImageGenerationSettings>({
    queryKey: ['admin', 'image-settings'],
    queryFn: () => adminAPI.getImageGenerationSettings(),
    enabled: !!(user && user.is_admin)
  });

  const { data: systemData, isLoading: _systemLoading } = useQuery<SystemSettings>({
    queryKey: ['admin', 'system-settings'],
    queryFn: () => adminAPI.getSystemSettings(),
    enabled: !!(user && user.is_admin)
  });

  useEffect(() => {
    if (multiNlpData) setMultiNlpSettings(multiNlpData);
  }, [multiNlpData]);

  useEffect(() => {
    if (parsingData) setParsingSettings(parsingData);
  }, [parsingData]);

  useEffect(() => {
    if (imageData) setImageSettings(imageData);
  }, [imageData]);

  useEffect(() => {
    if (systemData) setSystemSettings(systemData);
  }, [systemData]);

  const saveMultiNlpSettings = useMutation({
    mutationFn: (settings: MultiNLPSettings) => adminAPI.updateMultiNLPSettings(settings),
    onSuccess: () => {
      notify.success(t('admin.settingsSaved'), t('admin.multiNlpUpdated'));
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error: Error) => {
      notify.error(t('admin.saveFailed'), error.message);
    }
  });

  const saveParsingSettings = useMutation({
    mutationFn: (settings: ParsingSettings) => adminAPI.updateParsingSettings(settings),
    onSuccess: () => {
      notify.success(t('admin.settingsSaved'), t('admin.parsingUpdated'));
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error: Error) => {
      notify.error(t('admin.saveFailed'), error.message);
    }
  });

  // Reserved for future image settings functionality (currently unused)
  // const _saveImageSettings = useMutation({
  //   mutationFn: (settings: ImageGenerationSettings) => adminAPI.updateImageGenerationSettings(settings),
  //   onSuccess: () => {
  //     notify.success(t('admin.settingsSaved'), t('admin.imageUpdated'));
  //     queryClient.invalidateQueries({ queryKey: ['admin'] });
  //   },
  //   onError: (error: Error) => {
  //     notify.error(t('admin.saveFailed'), error.message);
  //   }
  // });

  // Reserved for future system settings functionality (currently unused)
  // const _saveSystemSettings = useMutation({
  //   mutationFn: (settings: SystemSettings) => adminAPI.updateSystemSettings(settings),
  //   onSuccess: () => {
  //     notify.success(t('admin.settingsSaved'), t('admin.systemUpdated'));
  //     queryClient.invalidateQueries({ queryKey: ['admin'] });
  //   },
  //   onError: (error: Error) => {
  //     notify.error(t('admin.saveFailed'), error.message);
  //   }
  // });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" text={t('admin.loadingDashboard')} />
      </div>
    );
  }

  if (!user || !user.is_admin) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('admin.accessDenied')}</h2>
        <p className="text-gray-600 dark:text-gray-400">{t('admin.accessDeniedDesc')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-8 h-8" />
            {t('admin.title')}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t('admin.subtitle')}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'overview', name: t('admin.overview'), icon: Activity },
              { id: 'nlp', name: t('admin.multiNlpSettings'), icon: Cpu },
              { id: 'parsing', name: t('admin.parsing'), icon: Database },
              { id: 'images', name: t('admin.images'), icon: Image },
              { id: 'system', name: t('admin.system'), icon: Server },
              { id: 'users', name: t('admin.users'), icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {statsError ? (
                <ErrorMessage
                  title={t('admin.failedToLoadStats')}
                  message={statsError.message}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* System Stats Cards */}
                  {stats && [
                    { title: t('admin.totalUsers'), value: stats.total_users, icon: Users, color: 'blue' },
                    { title: t('admin.totalBooks'), value: stats.total_books, icon: BookOpen, color: 'green' },
                    { title: t('admin.descriptions'), value: stats.total_descriptions, icon: Database, color: 'purple' },
                    { title: t('admin.generatedImages'), value: stats.total_images, icon: Image, color: 'orange' }
                  ].map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                      <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                              {statsLoading ? '...' : stat.value.toLocaleString()}
                            </p>
                          </div>
                          <Icon className={`w-8 h-8 text-${stat.color}-500`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* NLP Settings Tab */}
          {activeTab === 'nlp' && (
            <MultiNLPSettingsTab 
              settings={multiNlpSettings}
              setSettings={setMultiNlpSettings}
              isLoading={multiNlpLoading}
              onSave={(settings) => saveMultiNlpSettings.mutate(settings)}
              isSaving={saveMultiNlpSettings.isPending}
            />
          )}

          {/* Parsing Settings Tab */}
          {activeTab === 'parsing' && (
            <ParsingSettingsTab 
              settings={parsingSettings}
              setSettings={setParsingSettings}
              isLoading={parsingLoading}
              onSave={(settings) => saveParsingSettings.mutate(settings)}
              isSaving={saveParsingSettings.isPending}
            />
          )}

          {/* Images Tab */}
          {activeTab === 'images' && (
            <div className="text-center py-12">
              <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('admin.images')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('admin.imageSettings')}</p>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="text-center py-12">
              <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('admin.system')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('admin.systemSettings')}</p>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('admin.users')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('admin.userManagement')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;