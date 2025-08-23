import React from 'react';
import { useParams } from 'react-router-dom';

const BookPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Book Details Page
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Book ID: {bookId}
        </p>
        <p className="text-sm text-gray-500 mt-4">
          This page will show book details, chapters, and reading options.
        </p>
      </div>
    </div>
  );
};

export default BookPage;