/**
 * LibraryPage - Страница библиотеки книг
 *
 * Рефакторинг: Мигрировано на TanStack Query для правильного управления кэшем
 * - Использует useBooks hook вместо Zustand store
 * - Автоматическая инвалидация кэша при загрузке новых книг
 * - Поллинг для книг в обработке через refetchInterval
 *
 * Модульные компоненты:
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

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useBooks } from '@/hooks/api/useBooks';
import { bookKeys } from '@/hooks/api/queryKeys';
import { BookUploadModal } from '@/components/Books/BookUploadModal';
import { LibraryHeader } from '@/components/Library/LibraryHeader';
import { LibraryStats } from '@/components/Library/LibraryStats';
import { LibrarySearch } from '@/components/Library/LibrarySearch';
import { BookGrid } from '@/components/Library/BookGrid';
import { LibraryPagination } from '@/components/Library/LibraryPagination';
import { useLibraryFilters } from '@/hooks/library/useLibraryFilters';

const BOOKS_PER_PAGE = 10;

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_desc');

  // Calculate skip for pagination
  const skip = (currentPage - 1) * BOOKS_PER_PAGE;

  // Fetch books using TanStack Query
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useBooks(
    { skip, limit: BOOKS_PER_PAGE, sort_by: sortBy },
    {
      // Poll every 5 seconds if there are processing books
      refetchInterval: (query) => {
        const books = query.state.data?.books || [];
        const hasProcessing = books.some(b => b.is_processing);
        if (hasProcessing) {
          console.log('📊 [LIBRARY] Found processing books, polling enabled');
          return 5000;
        }
        return false;
      },
    }
  );

  const books = data?.books || [];
  const totalBooks = data?.total || 0;

  // Filter books and calculate stats
  const { filteredBooks, stats } = useLibraryFilters(books, searchQuery);

  // Calculate total pages for pagination
  const totalPages = useMemo(() =>
    Math.ceil(totalBooks / BOOKS_PER_PAGE),
    [totalBooks]
  );

  // Handlers
  const handleUploadClick = () => setShowUploadModal(true);
  const handleBookClick = (bookId: string) => navigate(`/book/${bookId}`);
  const handleClearSearch = () => setSearchQuery('');

  const handleParsingComplete = () => {
    console.log('[LibraryPage] Parsing completed, invalidating cache...');
    queryClient.invalidateQueries({ queryKey: bookKeys.all });
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Handle successful upload - invalidate cache to show new book
  const handleUploadSuccess = () => {
    console.log('[LibraryPage] Book uploaded successfully, invalidating cache...');
    // Invalidate all book-related queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: bookKeys.all });
    // Reset to first page to show the new book
    setCurrentPage(1);
  };

  const handleModalClose = () => {
    setShowUploadModal(false);
    // Refetch to ensure we have latest data
    refetch();
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
        onSortChange={handleSortChange}
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
          <p className="text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Ошибка загрузки книг'}
          </p>
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
        onClose={handleModalClose}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export default LibraryPage;
