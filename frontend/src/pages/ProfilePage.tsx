import React from 'react';

const ProfilePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          User Profile
        </h1>
        <p className="text-sm text-gray-500">
          This page will show user profile information and settings.
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;