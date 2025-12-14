/**
 * LibraryPage - Страница библиотеки книг
 *
 * Рефакторинг: Разбит на модульные компоненты
 * - LibraryHeader - Заголовок с кнопкой загрузки
 * - LibraryStats - Статистические карточки
 * - LibrarySearch - Поиск и фильтры
 * - BookGrid - Сетка/список книг
 * - LibraryPagination - Пагинация
 * - useLibraryFilters - Хук для фильтрации
 *
 * Features:
 * - Поиск и фильтрация книг
 * - Два режима отображения (grid/list)
 * - Автообновление при обработке книг
 * - Пагинация
 * - Responsive design
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooksStore } from '@/stores/books';
import { BookUploadModal } from '@/components/Books/BookUploadModal';
import { LibraryHeader } from '@/components/Library/LibraryHeader';
import { LibraryStats } from '@/components/Library/LibraryStats';
import { LibrarySearch } from '@/components/Library/LibrarySearch';
import { BookGrid } from '@/components/Library/BookGrid';
import { LibraryPagination } from '@/components/Library/LibraryPagination';
import { useLibraryFilters } from '@/hooks/library/useLibraryFilters';

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    books,
    isLoading,
    fetchBooks,
    error,
    totalBooks,
    currentPage,
    booksPerPage,
    sortBy,
    setSortBy,
    goToPage,
    nextPage,
    prevPage,
  } = useBooksStore();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch books on mount
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Auto-refresh when there are processing books
  useEffect(() => {
    const processingCount = books.filter(b => b.is_processing).length;

    if (processingCount > 0) {
      console.log(`📊 [LIBRARY] Found ${processingCount} processing books, starting polling...`);

      // Poll every 5 seconds to check if processing completed
      const pollInterval = setInterval(() => {
        console.log('🔄 [LIBRARY] Polling for book status updates...');
        fetchBooks();
      }, 5000);

      return () => {
        console.log('⏹️ [LIBRARY] Stopping polling');
        clearInterval(pollInterval);
      };
    }
  }, [books, fetchBooks]);

  // Filter books and calculate stats
  const { filteredBooks, stats } = useLibraryFilters(books, searchQuery);

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalBooks / booksPerPage);

  // Handlers
  const handleUploadClick = () => setShowUploadModal(true);
  const handleBookClick = (bookId: string) => navigate(`/book/${bookId}`);
  const handleClearSearch = () => setSearchQuery('');
  const handleParsingComplete = () => {
    console.log('[LibraryPage] Parsing completed, refreshing books...');
    fetchBooks();
  };

  // Loading state
  if (isLoading && books.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4" style={{ borderColor: 'var(--accent-color)' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Загрузка библиотеки...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <LibraryHeader
        totalBooks={totalBooks}
        filteredCount={filteredBooks.length}
        searchQuery={searchQuery}
        onUploadClick={handleUploadClick}
      />

      {/* Stats Cards */}
      <LibraryStats
        totalBooks={totalBooks}
        booksInProgress={stats.booksInProgress}
        booksCompleted={stats.booksCompleted}
        processingBooks={stats.processingBooks}
      />

      {/* Search and View Toggle */}
      <LibrarySearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
      />

      {/* Filters Panel */}
      {showFilters && (
        <div
          className="mb-6 p-6 rounded-2xl border-2"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Фильтры скоро появятся...
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Books Grid/List */}
      <BookGrid
        books={filteredBooks}
        viewMode={viewMode}
        searchQuery={searchQuery}
        onBookClick={handleBookClick}
        onClearSearch={handleClearSearch}
        onUploadClick={handleUploadClick}
        onParsingComplete={handleParsingComplete}
      />

      {/* Pagination */}
      {filteredBooks.length > 0 && (
        <LibraryPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalBooks}
          currentItems={books.length}
          onPageChange={goToPage}
          onNextPage={nextPage}
          onPrevPage={prevPage}
        />
      )}

      {/* Upload Modal */}
      <BookUploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          fetchBooks();
        }}
        onUploadSuccess={() => {
          console.log('[LibraryPage] Book uploaded successfully, refreshing list...');
          fetchBooks();
        }}
      />
    </div>
  );
};

export default LibraryPage;
