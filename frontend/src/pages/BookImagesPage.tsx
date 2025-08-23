import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { ImageGallery } from '@/components/Images/ImageGallery';
import { LoadingSpinner } from '@/components/UI/LoadingSpinner';
import { ErrorMessage } from '@/components/UI/ErrorMessage';

const BookImagesPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();

  // Fetch book data for header information
  const { data: book, isLoading: bookLoading, error: bookError } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId!),
    enabled: !!bookId,
  });

  if (!bookId) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <ErrorMessage title="Invalid Book" message="Book ID is required" />
      </div>
    );
  }

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" text="Loading book information..." />
      </div>
    );
  }

  if (bookError || !book) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <ErrorMessage 
          title="Book Not Found" 
          message="The requested book could not be loaded"
          action={{
            label: "Go Back to Library",
            onClick: () => window.history.back()
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link
            to="/library"
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          
          <div className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {book.title}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                by {book.author} • AI-Generated Images
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Link
            to={`/books/${bookId}`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Read Book
          </Link>
        </div>
      </div>

      {/* Book Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-sm">
        <div className="flex items-start space-x-6">
          <div className="w-24 h-32 bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
            {book.has_cover ? (
              <img
                src={`/api/v1/books/${book.id}/cover`}
                alt={`${book.title} cover`}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <BookOpen className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          
          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Chapters
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {book.total_chapters}
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Progress
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(book.reading_progress_percent || 0)}%
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Genre
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {book.genre || 'Unknown'}
                </p>
              </div>
            </div>
            
            {book.description && (
              <div className="mt-4">
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed line-clamp-3">
                  {book.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <ImageGallery
        bookId={bookId}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm"
      />
    </div>
  );
};

export default BookImagesPage;