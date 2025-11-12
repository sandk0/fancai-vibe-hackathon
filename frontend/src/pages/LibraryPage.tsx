/**
 * LibraryPage - Modern redesign with shadcn UI
 *
 * Features:
 * - Gradient header with stats
 * - Advanced search and filters
 * - Modern book cards with hover effects
 * - Reading progress visualization
 * - Empty states with call-to-action
 * - Fully theme-aware
 * - Responsive grid layout
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Book,
  Search,
  Filter,
  AlertCircle,
  BookOpen,
  Clock,
  TrendingUp,
  Grid3x3,
  List,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Calendar,
  Layers,
  BookMarked,
  BarChart3,
} from 'lucide-react';
import { useBooksStore } from '@/stores/books';
import { BookUploadModal } from '@/components/Books/BookUploadModal';
import { ParsingOverlay } from '@/components/UI/ParsingOverlay';
import { cn } from '@/lib/utils';

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
    hasMore,
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

  // Helper function: Format date as "2 ноября 2025г."
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).replace(' г.', 'г.');
  };

  // Helper function: Calculate current page from progress
  const getCurrentPage = (totalPages: number, progressPercent: number): number => {
    return Math.round((totalPages * progressPercent) / 100);
  };

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

  // Filter books based on search query (for display filtering, not pagination)
  const filteredBooks = books.filter(book => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query) ||
      book.genre?.toLowerCase().includes(query)
    );
  });

  // Calculate stats from current page
  const booksInProgress = books.filter(b => b.reading_progress_percent && b.reading_progress_percent > 0 && b.reading_progress_percent < 100).length;
  const booksCompleted = books.filter(b => b.reading_progress_percent === 100).length;
  const processingBooks = books.filter(b => b.is_processing).length;

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalBooks / booksPerPage);

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
      {/* Hero Header */}
      <div className="relative mb-12 overflow-hidden rounded-3xl">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: 'linear-gradient(135deg, var(--accent-color) 0%, rgba(147, 51, 234, 0.3) 100%)',
          }}
        />
        <div className="relative px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Моя библиотека 📚
              </h1>
              <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                {totalBooks === 0
                  ? 'Начните свое путешествие с первой книги'
                  : searchQuery
                  ? `Найдено ${filteredBooks.length} ${filteredBooks.length === 1 ? 'книга' : filteredBooks.length < 5 ? 'книги' : 'книг'}`
                  : `${totalBooks} ${totalBooks === 1 ? 'книга' : totalBooks < 5 ? 'книги' : 'книг'} в коллекции`}
              </p>
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className={cn(
                "group inline-flex items-center gap-2 px-6 py-3 rounded-xl",
                "font-semibold transition-all duration-200",
                "shadow-lg hover:shadow-xl hover:scale-105"
              )}
              style={{
                backgroundColor: 'var(--accent-color)',
                color: 'white',
              }}
            >
              <Plus className="w-5 h-5" />
              <span>Загрузить книгу</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {totalBooks > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div
            className="p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="w-8 h-8" style={{ color: 'var(--accent-color)' }} />
            </div>
            <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {totalBooks}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Всего книг
            </div>
          </div>

          <div
            className="p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {booksInProgress}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              В процессе
            </div>
          </div>

          <div
            className="p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {booksCompleted}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Завершено
            </div>
          </div>

          <div
            className="p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {processingBooks}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Обработка AI
            </div>
          </div>
        </div>
      )}

      {/* Search and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
              style={{ color: 'var(--text-tertiary)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, автору, жанру..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-3 rounded-xl border-2 transition-all",
              viewMode === 'grid' && "ring-2"
            )}
            style={{
              backgroundColor: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: viewMode === 'grid' ? 'white' : 'var(--text-primary)',
              ...(viewMode === 'grid' && { ringColor: 'var(--accent-color)' }),
            }}
          >
            <Grid3x3 className="w-5 h-5" />
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-3 rounded-xl border-2 transition-all",
              viewMode === 'list' && "ring-2"
            )}
            style={{
              backgroundColor: viewMode === 'list' ? 'var(--accent-color)' : 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: viewMode === 'list' ? 'white' : 'var(--text-primary)',
              ...(viewMode === 'list' && { ringColor: 'var(--accent-color)' }),
            }}
          >
            <List className="w-5 h-5" />
          </button>

          {/* Sorting Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none pl-10 pr-8 py-3 rounded-xl border-2 transition-all cursor-pointer focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="created_desc">Новые → Старые</option>
              <option value="created_asc">Старые → Новые</option>
              <option value="title_asc">Название А → Я</option>
              <option value="title_desc">Название Я → А</option>
              <option value="author_asc">Автор А → Я</option>
              <option value="author_desc">Автор Я → А</option>
              <option value="accessed_desc">Недавно читал</option>
            </select>
            <ArrowUpDown
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none"
              style={{ color: 'var(--text-tertiary)' }}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all",
              showFilters && "ring-2"
            )}
            style={{
              backgroundColor: showFilters ? 'var(--accent-color)' : 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: showFilters ? 'white' : 'var(--text-primary)',
              ...(showFilters && { ringColor: 'var(--accent-color)' }),
            }}
          >
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Фильтры</span>
          </button>
        </div>
      </div>

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
      {filteredBooks.length === 0 && searchQuery ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <Search className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Ничего не найдено
          </h3>
          <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            По запросу "{searchQuery}" книги не найдены
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
            }}
          >
            Очистить поиск
          </button>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <Book className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Библиотека пуста
          </h3>
          <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Загрузите вашу первую книгу и начните увлекательное путешествие с AI-визуализацией
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 shadow-lg"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
            }}
          >
            <Plus className="w-5 h-5" />
            Загрузить первую книгу
          </button>
        </div>
      ) : (
        <div
          className={cn(
            viewMode === 'grid'
              ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
              : 'space-y-4'
          )}
        >
          {filteredBooks.map((book) => (
            <div
              key={book.id}
              className={cn(
                "group cursor-pointer relative transition-all duration-300",
                viewMode === 'grid'
                  ? "hover:-translate-y-2"
                  : "p-4 rounded-2xl border-2 hover:shadow-lg",
                book.is_processing && "pointer-events-none"
              )}
              onClick={() => {
                if (book.is_parsed) {
                  navigate(`/book/${book.id}`);
                }
              }}
              style={
                viewMode === 'list'
                  ? {
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-color)',
                    }
                  : undefined
              }
            >
              {viewMode === 'grid' ? (
                <div className="flex flex-col h-full">
                  {/* Book Cover */}
                  <div className="aspect-[2/3] mb-3 relative rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow flex-shrink-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    {book.is_processing && (
                      <ParsingOverlay
                        bookId={book.id}
                        onParsingComplete={() => {
                          console.log('[LibraryPage] Parsing completed, refreshing books...');
                          fetchBooks();
                        }}
                        forceBlock={false}
                      />
                    )}
                    {book.has_cover ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`}
                        alt={`${book.title} cover`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Book className="w-12 h-12" style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                    )}
                  </div>

                  {/* Book Info */}
                  <div className="flex flex-col flex-1 min-h-0">
                    {/* Title & Author */}
                    <div className="mb-2 flex-shrink-0">
                      <h3
                        className="font-semibold text-sm line-clamp-2 mb-1 transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {book.title}
                      </h3>
                      <p className="text-xs line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                        {book.author}
                      </p>
                    </div>

                    {/* Metadata with Icons */}
                    <div className="space-y-1.5 text-xs mb-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      {/* Genre */}
                      {book.genre && (
                        <div className="flex items-center gap-1.5">
                          <BookMarked className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="line-clamp-1">{book.genre}</span>
                        </div>
                      )}

                      {/* Chapters */}
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{book.chapters_count} {book.chapters_count === 1 ? 'глава' : book.chapters_count < 5 ? 'главы' : 'глав'}</span>
                      </div>

                      {/* Upload Date */}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{formatDate(book.created_at)}</span>
                      </div>
                    </div>

                    {/* Progress Section */}
                    <div className="mt-auto">
                      {book.is_processing ? (
                        <div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Обработка AI...</span>
                        </div>
                      ) : book.reading_progress_percent !== undefined && book.reading_progress_percent > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>{getCurrentPage(book.total_pages, book.reading_progress_percent)}/{book.total_pages} стр</span>
                            </div>
                            <span style={{ color: 'var(--accent-color)' }} className="font-semibold">
                              {Math.round(book.reading_progress_percent)}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(book.reading_progress_percent, 100)}%`,
                                backgroundColor: 'var(--accent-color)',
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-4">
                  {/* Cover */}
                  <div className="w-24 h-32 flex-shrink-0 rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    {book.has_cover ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`}
                        alt={`${book.title} cover`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Book className="w-8 h-8" style={{ color: 'var(--text-tertiary)' }} />
                      </div>
                    )}
                  </div>

                  {/* Book Info */}
                  <div className="flex-1 min-w-0">
                    {/* Title & Author */}
                    <h3 className="font-bold text-lg mb-1 line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                      {book.title}
                    </h3>
                    <p className="text-sm mb-3 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                      {book.author}
                    </p>

                    {/* Metadata with Icons */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
                      {/* Genre */}
                      {book.genre && (
                        <div className="flex items-center gap-1.5">
                          <BookMarked className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{book.genre}</span>
                        </div>
                      )}

                      {/* Chapters */}
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 flex-shrink-0" />
                        <span>{book.chapters_count} {book.chapters_count === 1 ? 'глава' : book.chapters_count < 5 ? 'главы' : 'глав'}</span>
                      </div>

                      {/* Upload Date */}
                      <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                        <Calendar className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{formatDate(book.created_at)}</span>
                      </div>
                    </div>

                    {/* Progress Section */}
                    {book.is_processing ? (
                      <div className="flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>Обработка AI...</span>
                      </div>
                    ) : book.reading_progress_percent !== undefined && book.reading_progress_percent > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                            <BarChart3 className="w-4 h-4" />
                            <span>{getCurrentPage(book.total_pages, book.reading_progress_percent)} из {book.total_pages} стр</span>
                          </div>
                          <span style={{ color: 'var(--accent-color)' }} className="font-semibold">
                            {Math.round(book.reading_progress_percent)}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(book.reading_progress_percent, 100)}%`,
                              backgroundColor: 'var(--accent-color)',
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && filteredBooks.length > 0 && (
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Page info */}
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Страница {currentPage} из {totalPages} • Показано {books.length} из {totalBooks} книг
          </div>

          {/* Pagination controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => prevPage()}
              disabled={currentPage === 1}
              className={cn(
                "p-2 rounded-lg border-2 transition-all",
                currentPage === 1
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:scale-105"
              )}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={cn(
                      "w-10 h-10 rounded-lg border-2 transition-all font-semibold",
                      currentPage === pageNum
                        ? "ring-2"
                        : "hover:scale-105"
                    )}
                    style={{
                      backgroundColor: currentPage === pageNum ? 'var(--accent-color)' : 'var(--bg-primary)',
                      borderColor: 'var(--border-color)',
                      color: currentPage === pageNum ? 'white' : 'var(--text-primary)',
                      ...(currentPage === pageNum && { ringColor: 'var(--accent-color)' }),
                    }}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => nextPage()}
              disabled={!hasMore}
              className={cn(
                "p-2 rounded-lg border-2 transition-all",
                !hasMore
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:scale-105"
              )}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
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
