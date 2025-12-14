/**
 * useLibraryFilters - Хук для фильтрации и поиска книг в библиотеке
 *
 * Функциональность:
 * - Фильтрация книг по поисковому запросу (название, автор, жанр)
 * - Подсчет статистики (в процессе, завершенные, обрабатываются)
 * - Вспомогательные функции для форматирования
 *
 * @param books - Массив книг для фильтрации
 * @param searchQuery - Поисковый запрос
 * @returns Отфильтрованные книги и статистика
 */

import { useMemo } from 'react';
import type { Book } from '@/types/api';

interface LibraryStats {
  booksInProgress: number;
  booksCompleted: number;
  processingBooks: number;
}

interface UseLibraryFiltersReturn {
  filteredBooks: Book[];
  stats: LibraryStats;
}

export const useLibraryFilters = (
  books: Book[],
  searchQuery: string
): UseLibraryFiltersReturn => {
  // Filter books based on search query
  const filteredBooks = useMemo(() => {
    if (!searchQuery) return books;

    const query = searchQuery.toLowerCase();
    return books.filter(book => {
      return (
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.genre?.toLowerCase().includes(query)
      );
    });
  }, [books, searchQuery]);

  // Calculate statistics from all books (not filtered)
  const stats = useMemo((): LibraryStats => {
    const booksInProgress = books.filter(
      b => b.reading_progress_percent &&
           b.reading_progress_percent > 0 &&
           b.reading_progress_percent < 100
    ).length;

    const booksCompleted = books.filter(
      b => b.reading_progress_percent === 100
    ).length;

    const processingBooks = books.filter(
      b => b.is_processing
    ).length;

    return {
      booksInProgress,
      booksCompleted,
      processingBooks,
    };
  }, [books]);

  return {
    filteredBooks,
    stats,
  };
};
