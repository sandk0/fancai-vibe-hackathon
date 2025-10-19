import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Book, BookOpen, Clock, FileText, User, ArrowLeft, Play } from 'lucide-react';
import { booksAPI } from '@/api/books';
import { useTranslation } from '@/hooks/useTranslation';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

const BookPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: book, isLoading, error } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId!),
    enabled: !!bookId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16">
          <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('bookPage.notFound')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('bookPage.notFoundDesc')}
          </p>
          <button
            onClick={() => navigate('/library')}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('bookPage.backToLibrary')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/library')}
        className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        {t('bookPage.backToLibrary')}
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Book Cover */}
          <div className="lg:w-64 lg:flex-shrink-0">
            <div className="h-64 lg:h-96 bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center">
              {book.has_cover ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`}
                  alt={`${book.title} cover`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = 'w-full h-full flex items-center justify-center';
                      fallback.innerHTML = '<svg class="w-16 h-16 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>';
                      parent.appendChild(fallback);
                    }
                  }}
                />
              ) : (
                <Book className="w-16 h-16 text-gray-500 dark:text-gray-400" />
              )}
            </div>
          </div>

          {/* Book Details */}
          <div className="flex-1 p-8">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {book.title}
              </h1>
              <div className="flex items-center text-gray-600 dark:text-gray-400 mb-4">
                <User className="w-5 h-5 mr-2" />
                <span className="text-lg">{book.author}</span>
              </div>
              
              {/* Stats */}
              <div className="flex flex-wrap gap-6 text-sm text-gray-600 dark:text-gray-400 mb-6">
                <div className="flex items-center">
                  <BookOpen className="w-4 h-4 mr-1" />
                  <span>{book.chapters.length} {t('bookPage.chapters')}</span>
                </div>
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  <span>{book.total_pages} {t('bookPage.pages')}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>~{book.estimated_reading_time_hours} {t('bookPage.readTime')}</span>
                </div>
                <div className="flex items-center">
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs uppercase">
                    {book.file_format}
                  </span>
                </div>
              </div>

              {/* Reading Progress */}
              {book.reading_progress.progress_percent > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>{t('bookPage.readingProgress')}</span>
                    <span>{Math.round(book.reading_progress.progress_percent)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${book.reading_progress.progress_percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => navigate(`/book/${book.id}/chapter/${book.reading_progress.current_chapter}`)}
                  className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Play className="w-5 h-5 mr-2" />
                  {book.reading_progress.progress_percent > 0 ? t('bookPage.continueReading') : t('bookPage.startReading')}
                </button>
                <button
                  onClick={() => navigate(`/book/${book.id}/images`)}
                  className="inline-flex items-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('bookPage.viewImages')}
                </button>
              </div>
            </div>

            {/* Description */}
            {book.description && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {t('bookPage.description')}
                </h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {book.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chapters List */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {t('bookPage.chaptersList')} ({book.chapters.length})
          </h2>
          <div className="space-y-2">
            {book.chapters.map((chapter) => (
              <div
                key={chapter.id}
                onClick={() => navigate(`/book/${book.id}/chapter/${chapter.number}`)}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-12">
                    {chapter.number}
                  </span>
                  <div className="ml-4">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {chapter.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {chapter.word_count} {t('bookPage.words')} • ~{chapter.estimated_reading_time_minutes} {t('bookPage.minRead')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-gray-400">
                  {chapter.is_description_parsed && (
                    <span className="text-xs text-green-600 dark:text-green-400 mr-2">
                      {chapter.descriptions_found} {t('bookPage.descriptions')}
                    </span>
                  )}
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookPage;