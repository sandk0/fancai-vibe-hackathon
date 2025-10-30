import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-700">
          404
        </h1>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
          {t('errors.notFound')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          {t('errors.notFoundDesc')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Home className="w-5 h-5 mr-2" />
            {t('errors.goHome')}
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t('actions.goBack')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;