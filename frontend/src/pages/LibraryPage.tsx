/**
 * LibraryPage - Redesigned library page with mobile-first design
 *
 * Features:
 * - Mobile-first responsive grid (2/3-4/5-6 columns)
 * - Filters panel (genre, progress, date)
 * - Search bar with icon
 * - Skeleton loading state
 * - Empty state with illustration
 * - Floating action button for upload (mobile)
 * - CSS variables from design system
 *
 * Uses TanStack Query for data fetching with:
 * - Auto-invalidation on book upload
 * - Polling for processing books
 * - Optimistic updates
 */

import React, { useState, useMemo, useCallback, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { m, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Plus,
  X,
  ChevronDown,
  BookOpen,
  Clock,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useBooks, useDeleteBook } from '@/hooks/api/useBooks';
import { bookKeys, getCurrentUserId } from '@/hooks/api/queryKeys';
import { notify } from '@/stores/ui';
import { BookUploadModal } from '@/components/Books/BookUploadModal';
import { BookGrid } from '@/components/Library/BookGrid';
import { DeleteConfirmModal } from '@/components/Library/DeleteConfirmModal';
import { useLibraryFilters } from '@/hooks/library/useLibraryFilters';
import { cn } from '@/lib/utils';
import type { Book } from '@/types/api';

const BOOKS_PER_PAGE = 24;

// Sort options
const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Сначала новые', icon: SortDesc },
  { value: 'created_asc', label: 'Сначала старые', icon: SortAsc },
  { value: 'title_asc', label: 'По названию А-Я', icon: SortAsc },
  { value: 'title_desc', label: 'По названию Я-А', icon: SortDesc },
  { value: 'author_asc', label: 'По автору А-Я', icon: SortAsc },
  { value: 'accessed_desc', label: 'Недавно читал', icon: Clock },
];

// Genre filter options
const GENRE_OPTIONS = [
  { value: 'all', label: 'Все жанры' },
  { value: 'fiction', label: 'Художественная' },
  { value: 'non-fiction', label: 'Документальная' },
  { value: 'fantasy', label: 'Фэнтези' },
  { value: 'sci-fi', label: 'Научная фантастика' },
  { value: 'romance', label: 'Романтика' },
  { value: 'mystery', label: 'Детектив' },
  { value: 'thriller', label: 'Триллер' },
];

// Progress filter options
const PROGRESS_OPTIONS = [
  { value: 'all', label: 'Все книги', icon: BookOpen },
  { value: 'not_started', label: 'Не начаты', icon: BookOpen },
  { value: 'in_progress', label: 'В процессе', icon: Loader2 },
  { value: 'completed', label: 'Завершены', icon: CheckCircle },
];

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('created_desc');
  const [genreFilter, setGenreFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const [selectedBookForDelete, setSelectedBookForDelete] = useState<Book | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Debounce search query using useDeferredValue to prevent excessive filtering
  // This allows the input to remain responsive while deferring the expensive filtering operation
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Calculate skip for pagination
  const skip = (currentPage - 1) * BOOKS_PER_PAGE;

  // Fetch books using TanStack Query
  const { data, isLoading, error } = useBooks(
    { skip, limit: BOOKS_PER_PAGE, sort_by: sortBy },
    {
      refetchOnMount: 'always',
      refetchInterval: (query) => {
        const books = query.state.data?.books || [];
        const hasProcessing = books.some((b) => b.is_processing);
        return hasProcessing ? 5000 : false;
      },
    }
  );

  const books = data?.books || [];
  const totalBooks = data?.total || 0;

  // Delete mutation
  const deleteBookMutation = useDeleteBook({
    onSuccess: () => {
      notify.success('Книга удалена', 'Книга удалена из вашей библиотеки');
      setSelectedBookForDelete(null);
    },
    onError: (error) => {
      notify.error(
        'Ошибка удаления',
        error instanceof Error ? error.message : 'Не удалось удалить книгу'
      );
    },
  });

  // Filter books locally using deferred search query to prevent excessive re-renders
  const { filteredBooks, stats } = useLibraryFilters(books, deferredSearchQuery);

  // Apply additional filters
  const displayBooks = useMemo(() => {
    let result = filteredBooks;

    // Genre filter
    if (genreFilter !== 'all') {
      result = result.filter(
        (book) =>
          book.genre?.toLowerCase().includes(genreFilter.toLowerCase())
      );
    }

    // Progress filter
    if (progressFilter !== 'all') {
      result = result.filter((book) => {
        const progress = book.reading_progress_percent ?? 0;
        switch (progressFilter) {
          case 'not_started':
            return progress === 0;
          case 'in_progress':
            return progress > 0 && progress < 100;
          case 'completed':
            return progress >= 100;
          default:
            return true;
        }
      });
    }

    return result;
  }, [filteredBooks, genreFilter, progressFilter]);

  // Calculate total pages
  const totalPages = useMemo(
    () => Math.ceil(totalBooks / BOOKS_PER_PAGE),
    [totalBooks]
  );

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (genreFilter !== 'all') count++;
    if (progressFilter !== 'all') count++;
    return count;
  }, [genreFilter, progressFilter]);

  // Handlers
  const handleUploadClick = () => setShowUploadModal(true);
  const handleBookClick = (bookId: string) => navigate(`/book/${bookId}`);
  const handleClearSearch = () => setSearchQuery('');

  const handleParsingComplete = () => {
    const userId = getCurrentUserId();
    queryClient.invalidateQueries({ queryKey: bookKeys.all(userId) });
  };

  const handleSortChange = (newSort: string) => {
    setSortBy(newSort);
    setCurrentPage(1);
    setShowSortDropdown(false);
  };

  const handleClearFilters = () => {
    setGenreFilter('all');
    setProgressFilter('all');
  };

  const handleUploadSuccess = () => {
    setCurrentPage(1);
  };

  const handleModalClose = () => {
    setShowUploadModal(false);
  };

  // Delete handlers
  const handleDeleteClick = useCallback(
    (bookId: string) => {
      const book = books.find((b) => b.id === bookId);
      if (book) {
        setSelectedBookForDelete(book);
      }
    },
    [books]
  );

  const handleDeleteConfirm = useCallback(() => {
    if (selectedBookForDelete) {
      deleteBookMutation.mutate(selectedBookForDelete.id);
    }
  }, [selectedBookForDelete, deleteBookMutation]);

  const handleDeleteCancel = useCallback(() => {
    setSelectedBookForDelete(null);
  }, []);

  // Get current sort option
  const currentSortOption = SORT_OPTIONS.find((opt) => opt.value === sortBy);

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Моя библиотека
            </h1>
            <p className="text-muted-foreground mt-1">
              {totalBooks} {totalBooks === 1 ? 'книга' : totalBooks >= 2 && totalBooks <= 4 ? 'книги' : 'книг'}
              {stats.processingBooks > 0 && (
                <span className="ml-2 text-amber-600">
                  ({stats.processingBooks} обрабатывается)
                </span>
              )}
            </p>
          </div>

          {/* Desktop Upload Button */}
          <m.button
            className="hidden md:flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg min-h-[44px]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleUploadClick}
          >
            <Plus className="w-5 h-5" />
            <span>Загрузить книгу</span>
          </m.button>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию или автору..."
              className="w-full pl-12 pr-10 py-3 rounded-xl border-2 border-border bg-card text-foreground text-base placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all min-h-[44px]"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              aria-haspopup="listbox"
              aria-expanded={showSortDropdown}
              aria-label={`Sort by: ${currentSortOption?.label || 'Sort'}`}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-border bg-card text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[160px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {currentSortOption && (
                <currentSortOption.icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="flex-1 text-left text-sm">
                {currentSortOption?.label || 'Sort'}
              </span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform',
                  showSortDropdown && 'rotate-180'
                )}
                aria-hidden="true"
              />
            </button>

            <AnimatePresence>
              {showSortDropdown && (
                <>
                  <m.div
                    className="fixed inset-0 z-40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowSortDropdown(false)}
                  />
                  <m.div
                    className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-[100]"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        role="option"
                        aria-selected={sortBy === option.value}
                        onClick={() => handleSortChange(option.value)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors min-h-[44px]',
                          'focus:outline-none focus-visible:bg-muted',
                          sortBy === option.value
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        <option.icon className="w-4 h-4" aria-hidden="true" />
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </m.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-label={`Фильтры${activeFiltersCount > 0 ? ` (${activeFiltersCount} активно)` : ''}`}
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-colors min-h-[44px]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              showFilters || activeFiltersCount > 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted'
            )}
          >
            <Filter className="w-5 h-5" aria-hidden="true" />
            <span className="hidden sm:inline">Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-primary-foreground/20 text-xs font-semibold" aria-hidden="true">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <m.div
              className="mb-6 p-4 sm:p-6 rounded-xl border-2 border-border bg-card"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Genre Filter */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Жанр
                  </label>
                  <select
                    value={genreFilter}
                    onChange={(e) => setGenreFilter(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[44px]"
                  >
                    {GENRE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Progress Filter */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Прогресс чтения
                  </label>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by reading progress">
                    {PROGRESS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setProgressFilter(option.value)}
                        aria-pressed={progressFilter === option.value}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          progressFilter === option.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        )}
                      >
                        <option.icon className="w-4 h-4" aria-hidden="true" />
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-primary hover:text-primary/80 font-medium"
                  >
                    Сбросить фильтры
                  </button>
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <m.div
            className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-4 mb-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-destructive">
              {error instanceof Error ? error.message : 'Failed to load books'}
            </p>
          </m.div>
        )}

        {/* Books Grid */}
        <div aria-busy={isLoading && books.length === 0} aria-live="polite">
          <BookGrid
            books={displayBooks}
            isLoading={isLoading && books.length === 0}
            searchQuery={searchQuery}
            onBookClick={handleBookClick}
            onClearSearch={handleClearSearch}
            onUploadClick={handleUploadClick}
            onParsingComplete={handleParsingComplete}
            onDelete={handleDeleteClick}
          />
        </div>

        {/* Pagination */}
        {totalPages > 1 && displayBooks.length > 0 && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors min-h-[44px]"
            >
              Назад
            </button>
            <span className="px-4 py-2 text-muted-foreground">
              Страница {currentPage} из {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors min-h-[44px]"
            >
              Далее
            </button>
          </div>
        )}
      </div>

      {/* Mobile FAB (Floating Action Button) */}
      <m.button
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center z-30"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleUploadClick}
        aria-label="Загрузить книгу"
      >
        <Plus className="w-7 h-7" />
      </m.button>

      {/* Upload Modal */}
      <BookUploadModal
        isOpen={showUploadModal}
        onClose={handleModalClose}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!selectedBookForDelete}
        bookTitle={selectedBookForDelete?.title || ''}
        isDeleting={deleteBookMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default LibraryPage;
