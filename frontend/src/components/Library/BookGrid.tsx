/**
 * BookGrid - Сетка книг с поддержкой разных режимов отображения
 *
 * Отображает:
 * - Сетку книг в режиме grid (2-5 колонок в зависимости от экрана)
 * - Список книг в режиме list
 * - Empty state когда нет книг
 * - Empty state для поиска без результатов
 *
 * @param books - Массив книг для отображения
 * @param viewMode - Режим отображения (grid/list)
 * @param searchQuery - Поисковый запрос (для empty state)
 * @param onBookClick - Callback при клике на книгу
 * @param onClearSearch - Callback для очистки поиска
 * @param onUploadClick - Callback для загрузки первой книги
 * @param onParsingComplete - Callback при завершении обработки
 */

import { memo, useCallback } from 'react';
import { Book, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookCard } from './BookCard';
import type { Book as BookType } from '@/types/api';

interface BookGridProps {
  books: BookType[];
  viewMode: 'grid' | 'list';
  searchQuery?: string;
  onBookClick: (bookId: string) => void;
  onClearSearch?: () => void;
  onUploadClick?: () => void;
  onParsingComplete?: () => void;
  onDelete?: (bookId: string) => void;
}

/**
 * BookGrid - Memoized grid/list of book cards
 *
 * Optimization rationale:
 * - Prevents re-renders when parent state changes but books array is the same
 * - Uses useCallback for click handlers passed to BookCard children
 * - BookCard is already memoized, so stable callbacks prevent child re-renders
 */
export const BookGrid = memo(function BookGrid({
  books,
  viewMode,
  searchQuery,
  onBookClick,
  onClearSearch,
  onUploadClick,
  onParsingComplete,
  onDelete,
}: BookGridProps) {
  // Memoize book click handler factory to create stable callbacks per book
  // This is critical because BookCard is memoized - inline arrow functions
  // would break memoization by creating new function references on each render
  const createBookClickHandler = useCallback(
    (bookId: string) => () => onBookClick(bookId),
    [onBookClick]
  );
  // Empty state: No results from search
  if (books.length === 0 && searchQuery) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-muted">
          <Search className="w-10 h-10 text-muted-foreground/70" />
        </div>
        <h3 className="text-2xl font-bold mb-3 text-foreground">
          Ничего не найдено
        </h3>
        <p className="mb-6 max-w-sm mx-auto text-muted-foreground">
          По запросу "{searchQuery}" книги не найдены
        </p>
        {onClearSearch && (
          <button
            onClick={onClearSearch}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 bg-primary text-white"
          >
            Очистить поиск
          </button>
        )}
      </div>
    );
  }

  // Empty state: No books at all
  if (books.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-muted">
          <Book className="w-10 h-10 text-muted-foreground/70" />
        </div>
        <h3 className="text-2xl font-bold mb-3 text-foreground">
          Библиотека пуста
        </h3>
        <p className="mb-6 max-w-sm mx-auto text-muted-foreground">
          Загрузите вашу первую книгу и начните увлекательное путешествие с AI-визуализацией
        </p>
        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 shadow-lg bg-primary text-white"
          >
            <Plus className="w-5 h-5" />
            Загрузить первую книгу
          </button>
        )}
      </div>
    );
  }

  // Books grid/list
  return (
    <div
      className={cn(
        viewMode === 'grid'
          ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6'
          : 'space-y-4'
      )}
    >
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          viewMode={viewMode}
          onClick={createBookClickHandler(book.id)}
          onParsingComplete={onParsingComplete}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
});
