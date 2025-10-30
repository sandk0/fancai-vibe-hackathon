import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Upload, Sparkles, TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { useTranslation } from '@/hooks/useTranslation';

const HomePage: React.FC = () => {
  const { user } = useAuthStore();
  const setShowUploadModal = useUIStore(state => state.setShowUploadModal);
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Welcome Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          {t('home.welcomeTitle', { name: user?.full_name || 'Читатель' })}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          {t('home.welcomeSubtitle')}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Link
          to="/library"
          className="group p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
              →
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('home.browseLibrary')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {t('home.browseLibraryDesc')}
          </p>
        </Link>

        <button
          onClick={() => setShowUploadModal(true)}
          className="group p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <Upload className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
              +
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('home.uploadBook')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {t('home.uploadBookDesc')}
          </p>
        </button>

        <Link
          to="/images"
          className="group p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              ✨
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('home.aiGallery')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            {t('home.aiGalleryDesc')}
          </p>
        </Link>
      </div>

      {/* Recent Activity / Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reading Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-primary-600" />
            {t('home.readingProgress')}
          </h3>
          <div className="space-y-4">
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                {t('home.noBooksInProgress')}
              </p>
              <Link
                to="/library"
                className="inline-block mt-2 text-primary-600 hover:text-primary-700 font-medium"
              >
                {t('home.startReading')}
              </Link>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900 dark:to-purple-900 rounded-lg p-6 border border-primary-200 dark:border-primary-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ✨ {t('home.aiFeatures')}
          </h3>
          <ul className="space-y-3">
            <li className="flex items-start">
              <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{t('home.smartExtraction')}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('home.smartExtractionDesc')}
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{t('home.imageGeneration')}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('home.imageGenerationDesc')}
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">{t('home.readingAnalytics')}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('home.readingAnalyticsDesc')}
                </p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HomePage;