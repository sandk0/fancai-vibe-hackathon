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

import React from 'react';
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
}

export const BookGrid: React.FC<BookGridProps> = ({
  books,
  viewMode,
  searchQuery,
  onBookClick,
  onClearSearch,
  onUploadClick,
  onParsingComplete,
}) => {
  // Empty state: No results from search
  if (books.length === 0 && searchQuery) {
    return (
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
        {onClearSearch && (
          <button
            onClick={onClearSearch}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
            }}
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
        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <Book className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <h3 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Библиотека пуста
        </h3>
        <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Загрузите вашу первую книгу и начните увлекательное путешествие с AI-визуализацией
        </p>
        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 shadow-lg"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
            }}
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
          ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
          : 'space-y-4'
      )}
    >
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          viewMode={viewMode}
          onClick={() => onBookClick(book.id)}
          onParsingComplete={onParsingComplete}
        />
      ))}
    </div>
  );
};
