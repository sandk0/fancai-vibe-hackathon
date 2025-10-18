import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {t('profile.title')}
        </h1>
        <p className="text-sm text-gray-500">
          Эта страница будет показывать информацию профиля и настройки пользователя.
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;