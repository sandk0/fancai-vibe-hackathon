import React, { useState } from 'react';
import { Book, User, Bell, Shield, Palette, Info } from 'lucide-react';
import ReaderSettings from '@/components/Settings/ReaderSettings';
import { useAuthStore } from '@/stores/auth';

type SettingsTab = 'reader' | 'account' | 'notifications' | 'privacy' | 'about';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('reader');
  const { user } = useAuthStore();

  const tabs = [
    { id: 'reader' as SettingsTab, label: 'Reader', icon: Book, description: 'Font, theme, and reading preferences' },
    { id: 'account' as SettingsTab, label: 'Account', icon: User, description: 'Profile and subscription settings' },
    { id: 'notifications' as SettingsTab, label: 'Notifications', icon: Bell, description: 'Notification preferences' },
    { id: 'privacy' as SettingsTab, label: 'Privacy', icon: Shield, description: 'Privacy and security settings' },
    { id: 'about' as SettingsTab, label: 'About', icon: Info, description: 'App version and information' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'reader':
        return <ReaderSettings />;
      
      case 'account':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Account Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={user?.full_name || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    readOnly
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Account settings are currently read-only. Contact support to make changes.
              </p>
            </div>
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Book Processing</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when book processing is complete</p>
                  </div>
                  <input type="checkbox" defaultChecked className="toggle" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Image Generation</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when new images are generated</p>
                  </div>
                  <input type="checkbox" defaultChecked className="toggle" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">Reading Reminders</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get reminded to continue reading</p>
                  </div>
                  <input type="checkbox" className="toggle" />
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'privacy':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Privacy & Security
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-200">
                    Your books and reading data are stored securely and are not shared with third parties.
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">Data Collection</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• Reading progress and bookmarks</li>
                    <li>• Generated images from your books</li>
                    <li>• App usage statistics (anonymized)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'about':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                About BookReader AI
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Version</p>
                  <p className="text-gray-600 dark:text-gray-400">1.0.0 (Beta)</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Description</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    Transform your reading experience with AI-powered image generation from book descriptions.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Technology Stack</p>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    <li>• React 18 + TypeScript</li>
                    <li>• FastAPI + Python</li>
                    <li>• PostgreSQL Database</li>
                    <li>• AI Image Generation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Customize your reading experience and manage your account preferences
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-5 w-5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{tab.label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="mt-10 lg:mt-0 lg:col-span-9">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 lg:p-8">
              {renderTabContent()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;