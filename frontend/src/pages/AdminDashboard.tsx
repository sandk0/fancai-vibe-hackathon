import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, 
  Users, 
  BookOpen, 
  Image,
  Activity,
  Database,
  Cpu,
  MemoryStick,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { notify } from '@/stores/ui';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { adminAPI, type SystemStats, type NLPSettings, type ParsingSettings } from '@/api/admin';

// Separate component for NLP Settings
interface NLPSettingsTabProps {
  settings: NLPSettings | null;
  setSettings: (settings: NLPSettings) => void;
  isLoading: boolean;
  onSave: (settings: NLPSettings) => void;
  isSaving: boolean;
}

const NLPSettingsTab: React.FC<NLPSettingsTabProps> = ({
  settings,
  setSettings,
  isLoading,
  onSave,
  isSaving
}) => {
  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" text="Loading NLP settings..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          NLP Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              spaCy Model
            </label>
            <select
              value={settings.model_name}
              onChange={(e) => setSettings({ ...settings, model_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {settings.available_models.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              lg = large (best quality), md = medium, sm = small (fastest)
            </p>
          </div>

          {/* Confidence Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confidence Threshold
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.confidence_threshold}
              onChange={(e) => setSettings({ ...settings, confidence_threshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Current: {settings.confidence_threshold} (lower = more descriptions, higher = better quality)
            </p>
          </div>

          {/* Min Description Length */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Description Length (characters)
            </label>
            <input
              type="number"
              min="10"
              max="200"
              value={settings.min_description_length}
              onChange={(e) => setSettings({ ...settings, min_description_length: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Min Word Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Word Count
            </label>
            <input
              type="number"
              min="3"
              max="50"
              value={settings.min_word_count}
              onChange={(e) => setSettings({ ...settings, min_word_count: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Max Description Length */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Description Length (characters)
            </label>
            <input
              type="number"
              min="500"
              max="2000"
              value={settings.max_description_length}
              onChange={(e) => setSettings({ ...settings, max_description_length: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Min Sentence Length */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Sentence Length (characters)
            </label>
            <input
              type="number"
              min="10"
              max="100"
              value={settings.min_sentence_length}
              onChange={(e) => setSettings({ ...settings, min_sentence_length: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => onSave(settings)}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save NLP Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// Separate component for Parsing Settings
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
  if (isLoading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" text="Loading parsing settings..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
          Parsing Queue Configuration
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Max Concurrent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Concurrent Parsing Tasks
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={settings.max_concurrent_parsing}
              onChange={(e) => setSettings({ ...settings, max_concurrent_parsing: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Higher values increase throughput but use more resources
            </p>
          </div>

          {/* Timeout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Parsing Timeout (minutes)
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

          {/* Priority Weights */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Subscription Plan Priorities
            </label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">FREE</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.queue_priority_weights.free}
                  onChange={(e) => setSettings({
                    ...settings,
                    queue_priority_weights: {
                      ...settings.queue_priority_weights,
                      free: parseInt(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">PREMIUM</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.queue_priority_weights.premium}
                  onChange={(e) => setSettings({
                    ...settings,
                    queue_priority_weights: {
                      ...settings.queue_priority_weights,
                      premium: parseInt(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">ULTIMATE</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.queue_priority_weights.ultimate}
                  onChange={(e) => setSettings({
                    ...settings,
                    queue_priority_weights: {
                      ...settings.queue_priority_weights,
                      ultimate: parseInt(e.target.value)
                    }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Higher values = higher priority in parsing queue
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => onSave(settings)}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Parsing Settings
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const { user, isLoading } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'nlp' | 'parsing' | 'users'>('overview');
  const [nlpSettings, setNlpSettings] = useState<NLPSettings | null>(null);
  const [parsingSettings, setParsingSettings] = useState<ParsingSettings | null>(null);

  // Always call hooks regardless of user state
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<SystemStats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminAPI.getSystemStats(),
    refetchInterval: 30000,
    enabled: !!(user && user.is_admin)
  });

  const { data: nlpData, isLoading: nlpLoading } = useQuery<NLPSettings>({
    queryKey: ['admin', 'nlp-settings'],
    queryFn: () => adminAPI.getNLPSettings(),
    enabled: !!(user && user.is_admin)
  });

  const { data: parsingData, isLoading: parsingLoading } = useQuery<ParsingSettings>({
    queryKey: ['admin', 'parsing-settings'],
    queryFn: () => adminAPI.getParsingSettings(),
    enabled: !!(user && user.is_admin)
  });

  useEffect(() => {
    if (nlpData) setNlpSettings(nlpData);
  }, [nlpData]);

  useEffect(() => {
    if (parsingData) setParsingSettings(parsingData);
  }, [parsingData]);

  const saveNlpSettings = useMutation({
    mutationFn: (settings: NLPSettings) => adminAPI.updateNLPSettings(settings),
    onSuccess: () => {
      notify.success('Settings Saved', 'NLP settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error: Error) => {
      notify.error('Save Failed', error.message);
    }
  });

  const saveParsingSettings = useMutation({
    mutationFn: (settings: ParsingSettings) => adminAPI.updateParsingSettings(settings),
    onSuccess: () => {
      notify.success('Settings Saved', 'Parsing settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error: Error) => {
      notify.error('Save Failed', error.message);
    }
  });
  
  // Conditional rendering within JSX instead of early returns
  const isAdmin = user && user.is_admin;
  
  return (
    <div className="max-w-7xl mx-auto p-6">
      {isLoading ? (
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" text="Loading..." />
        </div>
      ) : !isAdmin ? (
        <div className="flex items-center justify-center min-h-screen">
          <ErrorMessage 
            title="Access Denied"
            message="You need administrator privileges to access this page."
            action={{ 
              label: "Go to Library", 
              onClick: () => window.location.href = '/library' 
            }}
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Administrator Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              System monitoring and configuration
            </p>
            
            {/* Debug info */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Logged in as: <strong>{user?.email}</strong> | Admin: <strong>{user?.is_admin ? 'Yes' : 'No'}</strong>
              </p>
              <button 
                onClick={() => {
                  console.log('🔍 Current localStorage tokens:');
                  console.log('Access token:', localStorage.getItem('bookreader_access_token') ? 'Present' : 'Missing');
                  console.log('Refresh token:', localStorage.getItem('bookreader_refresh_token') ? 'Present' : 'Missing');
                  console.log('User data:', localStorage.getItem('bookreader_user_data') ? 'Present' : 'Missing');
                }}
                className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Debug Auth Status
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'nlp', label: 'NLP Settings', icon: Cpu },
                { id: 'parsing', label: 'Parsing Queue', icon: Settings },
                { id: 'users', label: 'Users', icon: Users }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {statsLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="lg" text="Loading system stats..." />
                </div>
              ) : statsError ? (
                <ErrorMessage title="Stats Error" message="Failed to load system statistics" />
              ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <Users className="w-8 h-8 text-blue-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_users}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <BookOpen className="w-8 h-8 text-green-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Books Processed</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_books}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <Database className="w-8 h-8 text-purple-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Descriptions</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_descriptions}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <Image className="w-8 h-8 text-orange-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Images Generated</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_images}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <Activity className="w-8 h-8 text-red-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Parsing</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active_parsing_tasks}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <AlertTriangle className="w-8 h-8 text-yellow-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Queue Size</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.queue_size}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <MemoryStick className="w-8 h-8 text-indigo-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Processing Rate</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.processing_rate}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                      <CheckCircle className="w-8 h-8 text-teal-500" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Generation Rate</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.generation_rate}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* NLP Settings Tab */}
          {activeTab === 'nlp' && (
            <NLPSettingsTab 
              settings={nlpSettings}
              setSettings={setNlpSettings}
              isLoading={nlpLoading}
              onSave={(settings) => saveNlpSettings.mutate(settings)}
              isSaving={saveNlpSettings.isPending}
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

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">
                User Management
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                User management features will be implemented here.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminDashboard;