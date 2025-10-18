import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { ImageGallery } from '@/components/Images/ImageGallery';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { useTranslation } from '@/hooks/useTranslation';

const BookImagesPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const { t } = useTranslation();

  // Fetch book data for header information
  const { data: book, isLoading: bookLoading, error: bookError } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId!),
    enabled: !!bookId,
  });

  if (!bookId) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <ErrorMessage title={t('images.invalidBook')} message={t('images.bookIdRequired')} />
      </div>
    );
  }

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" text={t('images.loadingBookInfo')} />
      </div>
    );
  }

  if (bookError || !book) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <ErrorMessage
          title={t('images.bookNotFound')}
          message={t('images.bookNotFoundDesc')}
          action={{
            label: t('images.goBackToLibrary'),
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
                {book.author} • {t('images.aiGeneratedImages')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Link
            to={`/books/${bookId}`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('images.readBook')}
          </Link>
        </div>
      </div>

      {/* Book Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-8 shadow-sm">
        <div className="flex items-start space-x-6">
          <div className="w-24 h-32 bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
            {book.has_cover ? (
              <img
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`}
                alt={`${book.title} cover`}
                className="w-full h-full object-cover rounded-lg"
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = document.createElement('div');
                    fallback.className = 'w-full h-full flex items-center justify-center';
                    fallback.innerHTML = '<svg class="w-8 h-8 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>';
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <BookOpen className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          
          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  {t('images.chapters')}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {book.total_chapters}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  {t('images.progress')}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(book.reading_progress_percent || 0)}%
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  {t('images.genre')}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {book.genre || t('images.unknown')}
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