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
} from 'lucide-react';
import { useBooksStore } from '@/stores/books';
import { BookUploadModal } from '@/components/Books/BookUploadModal';
import { ParsingOverlay } from '@/components/UI/ParsingOverlay';
import { cn } from '@/lib/utils';

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, isLoading, fetchBooks, error } = useBooksStore();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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

  // Calculate stats
  const totalBooks = books.length;
  const booksInProgress = books.filter(b => b.reading_progress_percent && b.reading_progress_percent > 0 && b.reading_progress_percent < 100).length;
  const booksCompleted = books.filter(b => b.reading_progress_percent === 100).length;
  const processingBooks = books.filter(b => !b.is_parsed).length;

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
                {filteredBooks.length === 0
                  ? 'Начните свое путешествие с первой книги'
                  : `${filteredBooks.length} ${filteredBooks.length === 1 ? 'книга' : 'книг'} в коллекции`}
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
                !book.is_parsed && "pointer-events-none"
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
                <>
                  <div className="book-cover mb-3 relative rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    {!book.is_parsed && (
                      <ParsingOverlay
                        bookId={book.id}
                        onParsingComplete={() => fetchBooks()}
                        forceBlock={true}
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

                  <div className="space-y-2">
                    <h3
                      className="font-semibold text-sm line-clamp-2 transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {book.title}
                    </h3>
                    <p className="text-xs line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                      {book.author}
                    </p>

                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      <span>{book.chapters_count} гл.</span>
                      {!book.is_parsed ? (
                        <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          AI
                        </span>
                      ) : book.reading_progress_percent !== undefined && book.reading_progress_percent > 0 ? (
                        <span style={{ color: 'var(--accent-color)' }} className="font-semibold">
                          {Math.round(book.reading_progress_percent)}%
                        </span>
                      ) : null}
                    </div>

                    {book.reading_progress_percent !== undefined && book.reading_progress_percent > 0 && (
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(book.reading_progress_percent, 100)}%`,
                            backgroundColor: 'var(--accent-color)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex gap-4">
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

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg mb-1 line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                      {book.title}
                    </h3>
                    <p className="text-sm mb-2 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                      {book.author}
                    </p>

                    <div className="flex items-center gap-4 text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
                      <span>{book.chapters_count} глав</span>
                      {book.genre && <span>•</span>}
                      {book.genre && <span>{book.genre}</span>}
                    </div>

                    {book.reading_progress_percent !== undefined && book.reading_progress_percent > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>Прогресс</span>
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
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
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
