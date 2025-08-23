import React from 'react';
import { useParams } from 'react-router-dom';

const ChapterPage: React.FC = () => {
  const { bookId, chapterNumber } = useParams<{ bookId: string; chapterNumber: string }>();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Chapter Reader
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Book ID: {bookId}, Chapter: {chapterNumber}
        </p>
        <p className="text-sm text-gray-500 mt-4">
          This page will show the chapter content with AI-generated images.
        </p>
      </div>
    </div>
  );
};

export default ChapterPage;