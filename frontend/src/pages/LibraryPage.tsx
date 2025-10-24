import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Book, Search, Filter, AlertCircle } from 'lucide-react';
import { useBooksStore } from '@/stores/books';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import { BookUploadModal } from '@/components/Books/BookUploadModal';
import { ParsingOverlay } from '@/components/UI/ParsingOverlay';
import { useTranslation } from '@/hooks/useTranslation';

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, isLoading, fetchBooks, error } = useBooksStore();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Filter books based on search query
  const filteredBooks = books.filter(book => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query) ||
      book.genre?.toLowerCase().includes(query)
    );
  });

  if (isLoading && books.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('library.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {filteredBooks.length === 1
              ? t('library.oneBook')
              : t('library.booksCount', { count: filteredBooks.length })}
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors mt-4 sm:mt-0"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('library.uploadBook')}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('library.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${showFilters ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
        >
          <Filter className="w-5 h-5 mr-2 text-gray-500" />
          {t('library.filters')}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('library.filtersComingSoon')}
          </p>
        </div>
      )}

      {/* Books Grid */}
      {filteredBooks.length === 0 && searchQuery ? (
        <div className="text-center py-16">
          <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('library.noResultsTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            {t('library.noResultsDesc').replace('{query}', searchQuery)}
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('library.clearSearch')}
          </button>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-16">
          <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('library.noBooksTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            {t('library.noBooksDesc')}
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('library.uploadFirstBook')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredBooks.map((book) => {
            console.log(`[LibraryPage] Book ${book.title}: is_parsed=${book.is_parsed}`);
            return (
            <div
              key={book.id}
              className="group cursor-pointer relative"
              onClick={() => {
                // Don't navigate if book is not parsed
                if (!book.is_parsed) {
                  // Show parsing status instead
                  return;
                }
                navigate(`/book/${book.id}`);
              }}
            >
              <div className="book-cover bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center mb-3 relative">
                {/* Parsing overlay for unparsed books */}
                {(() => {
                  const shouldShowOverlay = !book.is_parsed;
                  console.log(`[LibraryPage] Should show overlay for ${book.title}: ${shouldShowOverlay} (is_parsed: ${book.is_parsed})`);
                  return shouldShowOverlay;
                })() && (
                  <ParsingOverlay
                    bookId={book.id}
                    onParsingComplete={() => {
                      // Refresh books list when parsing completes
                      fetchBooks();
                    }}
                    forceBlock={true}
                  />
                )}
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
                        fallback.innerHTML = '<svg class="w-12 h-12 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                ) : (
                  <Book className="w-12 h-12 text-gray-500 dark:text-gray-400" />
                )}
              </div>
              
              <div className="space-y-1">
                <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2 group-hover:text-primary-600 transition-colors">
                  {book.title}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                  {book.author}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                  <span>
                    {book.chapters_count === 1
                      ? t('library.oneChapter')
                      : `${book.chapters_count} ${t('library.chapters')}`}
                  </span>
                  {!book.is_parsed ? (
                    <span className="text-yellow-600 dark:text-yellow-400 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {t('library.processing')}
                    </span>
                  ) : book.reading_progress_percent !== undefined && book.reading_progress_percent > 0 ? (
                    <span>{Math.round(book.reading_progress_percent)}%</span>
                  ) : null}
                </div>
                {book.reading_progress_percent !== undefined && book.reading_progress_percent > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-primary-600 h-1 rounded-full transition-all" 
                      style={{ width: `${Math.min(book.reading_progress_percent, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Upload Modal */}
      <BookUploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          // Обновляем список книг после закрытия модала
          fetchBooks();
        }}
        onUploadSuccess={() => {
          // Обновляем список книг сразу после успешной загрузки
          console.log('[LibraryPage] Book uploaded successfully, refreshing list...');
          fetchBooks();
        }}
      />
    </div>
  );
};

export default LibraryPage;