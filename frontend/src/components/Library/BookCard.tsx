/**
 * BookCard - Карточка книги с поддержкой двух режимов отображения
 *
 * Режимы:
 * - grid - Компактная карточка с обложкой сверху
 * - list - Широкая карточка с обложкой слева
 *
 * Отображает:
 * - Обложку книги или плейсхолдер
 * - Название и автора
 * - Метаданные (жанр, главы, дата загрузки)
 * - Прогресс чтения (если есть)
 * - Индикатор обработки AI
 *
 * @param book - Данные книги
 * @param viewMode - Режим отображения (grid/list)
 * @param onClick - Callback при клике на карточку
 */

import { memo, useCallback, useMemo } from 'react';
import { Book, AlertCircle, BookMarked, Layers, Calendar, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParsingOverlay } from '@/components/UI/ParsingOverlay';
import type { Book as BookType } from '@/types/api';

interface BookCardProps {
  book: BookType;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onParsingComplete?: () => void;
}

// Helper: Format date as "2 ноября 2025г."
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).replace(' г.', 'г.');
};

// Helper: Calculate current page from progress
const getCurrentPage = (totalPages: number, progressPercent: number): number => {
  return Math.round((totalPages * progressPercent) / 100);
};

/**
 * BookCard - Memoized book card component
 *
 * Optimization rationale:
 * - Rendered in a list via BookGrid.map() - prevents unnecessary re-renders
 * - onClick handler memoized to maintain referential equality
 * - coverUrl memoized as it involves string concatenation
 */
export const BookCard = memo(function BookCard({
  book,
  viewMode,
  onClick,
  onParsingComplete,
}: BookCardProps) {
  // Memoize coverUrl - involves string concatenation on each render
  const coverUrl = useMemo(() => {
    return book.has_cover
      ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`
      : null;
  }, [book.has_cover, book.id]);

  const isClickable = book.is_parsed && !book.is_processing;

  // Memoize click handler to prevent child re-renders
  const handleClick = useCallback(() => {
    if (isClickable) {
      onClick();
    }
  }, [isClickable, onClick]);

  // Grid View
  if (viewMode === 'grid') {
    return (
      <div
        className={cn(
          "group cursor-pointer relative transition-all duration-300 hover:-translate-y-2",
          !isClickable && "pointer-events-none"
        )}
        onClick={handleClick}
      >
        <div className="flex flex-col h-full">
          {/* Book Cover */}
          <div className="aspect-[2/3] mb-3 relative rounded-xl overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow flex-shrink-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {book.is_processing && onParsingComplete && (
              <ParsingOverlay
                bookId={book.id}
                onParsingComplete={onParsingComplete}
                forceBlock={false}
              />
            )}
            {coverUrl ? (
              <img
                src={coverUrl}
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
      </div>
    );
  }

  // List View
  return (
    <div
      className={cn(
        "group cursor-pointer p-4 rounded-2xl border-2 hover:shadow-lg transition-all duration-300",
        !isClickable && "pointer-events-none"
      )}
      onClick={handleClick}
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="flex gap-4">
        {/* Cover */}
        <div className="w-24 h-32 flex-shrink-0 rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          {coverUrl ? (
            <img
              src={coverUrl}
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
    </div>
  );
});
