import React, { useEffect } from 'react';
import { Plus, Book, Search, Filter } from 'lucide-react';
import { useBooksStore } from '@/stores/books';
import { useUIStore } from '@/stores/ui';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

const LibraryPage: React.FC = () => {
  const { books, isLoading, fetchBooks, error } = useBooksStore();
  const { setShowUploadModal } = useUIStore();

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

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
            My Library
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {books.length} books in your collection
          </p>
        </div>
        
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors mt-4 sm:mt-0"
        >
          <Plus className="w-5 h-5 mr-2" />
          Upload Book
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search your books..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <button className="inline-flex items-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <Filter className="w-5 h-5 mr-2 text-gray-500" />
          Filters
        </button>
      </div>

      {/* Books Grid */}
      {books.length === 0 ? (
        <div className="text-center py-16">
          <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No books yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Upload your first EPUB or FB2 file to start reading with AI-generated illustrations
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Upload Your First Book
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {books.map((book) => (
            <div
              key={book.id}
              className="group cursor-pointer"
              onClick={() => {/* TODO: Navigate to book */}}
            >
              <div className="book-cover bg-gradient-to-b from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center mb-3">
                {book.has_cover ? (
                  <img
                    src={`/api/v1/books/${book.id}/cover`}
                    alt={`${book.title} cover`}
                    className="w-full h-full object-cover"
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
                  <span>{book.chapters_count} chapters</span>
                  {book.reading_progress_percent > 0 && (
                    <span>{Math.round(book.reading_progress_percent)}%</span>
                  )}
                </div>
                {book.reading_progress_percent > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                    <div 
                      className="bg-primary-600 h-1 rounded-full transition-all" 
                      style={{ width: `${book.reading_progress_percent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
};

export default LibraryPage;