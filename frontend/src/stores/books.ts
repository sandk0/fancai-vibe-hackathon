 
// Books Store

import { create } from 'zustand';
import { booksAPI } from '@/api/books';
import type { BooksState } from '@/types/state';
import { getErrorMessage } from '@/utils/errors';
import { chapterCache } from '@/services/chapterCache';
import { imageCache } from '@/services/imageCache';

export const useBooksStore = create<BooksState>((set, get) => ({
  // Initial state
  books: [],
  currentBook: null,
  currentChapter: null,
  isLoading: false,
  error: null,
  totalBooks: 0,
  currentPage: 1,
  booksPerPage: 10, // PAGINATION: 10 books per page
  hasMore: true,
  sortBy: 'created_desc', // DEFAULT SORT: newest first

  // Actions
  refreshBooks: async () => {
    // Refresh without changing sort order (don't pass sortBy to preserve current)
    return get().fetchBooks(get().currentPage, get().booksPerPage);
  },
  fetchBooks: async (page = 1, limit = 10, sortBy?: string) => {
    set({ isLoading: true, error: null });

    try {
      const skip = (page - 1) * limit;
      // Only include sort_by if explicitly provided
      const params: { skip: number; limit: number; sort_by?: string } = { skip, limit };
      if (sortBy) {
        params.sort_by = sortBy;
      }
      const response = await booksAPI.getBooks(params);

      // Pagination logic: page 1 replaces, page > 1 appends (infinite scroll)
      const currentBooks = get().books;
      const newBooks = page === 1 ? response.books : [...currentBooks, ...response.books];
      const hasMore = skip + response.books.length < response.total;

      set({
        books: newBooks,
        totalBooks: response.total,
        currentPage: page,
        booksPerPage: limit,
        sortBy: sortBy || get().sortBy, // Preserve current sortBy if not provided
        hasMore,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to fetch books')
      });
      throw error;
    }
  },

  // Pagination helper methods
  goToPage: async (page: number) => {
    const { booksPerPage, sortBy } = get();
    await get().fetchBooks(page, booksPerPage, sortBy);
  },

  nextPage: async () => {
    const { currentPage, hasMore } = get();
    if (hasMore) {
      await get().goToPage(currentPage + 1);
    }
  },

  prevPage: async () => {
    const { currentPage } = get();
    if (currentPage > 1) {
      await get().goToPage(currentPage - 1);
    }
  },

  // Sort method
  setSortBy: async (sortBy: string) => {
    const { booksPerPage } = get();
    // When changing sort, go back to page 1
    await get().fetchBooks(1, booksPerPage, sortBy);
  },

  fetchBook: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const book = await booksAPI.getBook(bookId);
      set({ 
        currentBook: book,
        isLoading: false 
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to fetch book')
      });
      throw error;
    }
  },

  fetchChapter: async (bookId: string, chapterNumber: number) => {
    set({ isLoading: true, error: null });

    try {
      const response = await booksAPI.getChapter(bookId, chapterNumber);
      set({
        currentChapter: response.chapter,
        isLoading: false
      });
      return response; // Return full response including navigation
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to fetch chapter')
      });
      throw error;
    }
  },

  uploadBook: async (file: File) => {
    set({ isLoading: true, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await booksAPI.uploadBook(formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      });

      // Reload first page to show newly uploaded book
      console.log('[BOOKS STORE] Reloading book list after upload...');
      await get().fetchBooks(1, get().booksPerPage);

      set({ isLoading: false });

      // Convert BookUploadResponse to Book format
      const { book } = response;
      return {
        id: book.id,
        title: book.title,
        author: book.author,
        chapters_count: book.chapters_count,
        total_pages: book.total_pages,
        estimated_reading_time_hours: book.estimated_reading_time_hours,
        has_cover: book.has_cover,
        created_at: book.created_at,
        reading_progress_percent: book.reading_progress_percent || 0,
        is_parsed: book.is_parsed,
        is_processing: book.is_processing,
      };
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to upload book')
      });
      throw error;
    }
  },

  deleteBook: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      await booksAPI.deleteBook(bookId);

      // Очистка кэшей для удаляемой книги
      console.log('🗑️ [BooksStore] Clearing caches for deleted book:', bookId);
      await Promise.all([
        chapterCache.clearBook(bookId),
        imageCache.clearBook(bookId),
      ]).catch((err) => {
        console.warn('⚠️ [BooksStore] Error clearing caches:', err);
      });

      // Remove book from current list
      const { books } = get();
      set({
        books: books.filter(book => book.id !== bookId),
        currentBook: get().currentBook?.id === bookId ? null : get().currentBook,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: getErrorMessage(error, 'Failed to delete book')
      });
      throw error;
    }
  },

  updateReadingProgress: async (bookId: string, _currentPage: number, chapterNumber: number) => {
    try {
      const response = await booksAPI.updateReadingProgress(bookId, {
        current_chapter: chapterNumber,
        current_position_percent: 0, // Временное значение для совместимости
      });

      // Update the book in the current list
      const { books, currentBook } = get();
      const updatedBooks = books.map(book => {
        if (book.id === bookId) {
          return {
            ...book,
            reading_progress_percent: response.progress ?
              (response.progress.current_page / book.total_pages) * 100 : 0
          };
        }
        return book;
      });

      set({
        books: updatedBooks,
        currentBook: currentBook?.id === bookId ?
          updatedBooks.find(book => book.id === bookId) || currentBook :
          currentBook
      });
    } catch (error) {
      console.error('Failed to update reading progress:', error);
      throw error;
    }
  },

  setCurrentBook: (book) => {
    set({ currentBook: book });
  },

  setCurrentChapter: (chapter) => {
    set({ currentChapter: chapter });
  },

  clearError: () => {
    set({ error: null });
  },
}));