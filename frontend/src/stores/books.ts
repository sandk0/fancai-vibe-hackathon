 
// Books Store

import { create } from 'zustand';
import { booksAPI } from '@/api/books';
import type { BooksState } from '@/types/state';

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
    return get().fetchBooks(get().currentPage, get().booksPerPage, get().sortBy);
  },
  fetchBooks: async (page = 1, limit = 10, sortBy = 'created_desc') => {
    set({ isLoading: true, error: null });

    try {
      const skip = (page - 1) * limit;
      const response = await booksAPI.getBooks({ skip, limit, sort_by: sortBy });

      // Simple pagination: always replace books with current page data
      const hasMore = skip + response.books.length < response.total;

      set({
        books: response.books,
        totalBooks: response.total,
        currentPage: page,
        booksPerPage: limit,
        sortBy,
        hasMore,
        isLoading: false,
      });
    } catch (error: Error | { response?: { data?: { detail?: string; message?: string } } }) {
      set({
        isLoading: false,
        error: error.message || 'Failed to fetch books'
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
    } catch (error: Error | { response?: { data?: { detail?: string; message?: string } } }) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to fetch book' 
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
      return response;
    } catch (error: Error | { response?: { data?: { detail?: string; message?: string } } }) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to fetch chapter' 
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
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log(`Upload progress: ${percentCompleted}%`);
        }
      });

      // Reload first page to show newly uploaded book
      console.log('[BOOKS STORE] Reloading book list after upload...');
      await get().fetchBooks(1, get().booksPerPage);

      set({ isLoading: false });
      return response;
    } catch (error: Error | { response?: { data?: { detail?: string; message?: string } } }) {
      set({
        isLoading: false,
        error: error.message || 'Failed to upload book'
      });
      throw error;
    }
  },

  deleteBook: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      await booksAPI.deleteBook(bookId);

      // Remove book from current list
      const { books } = get();
      set({
        books: books.filter(book => book.id !== bookId),
        currentBook: get().currentBook?.id === bookId ? null : get().currentBook,
        isLoading: false,
      });
    } catch (error: Error | { response?: { data?: { detail?: string; message?: string } } }) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to delete book' 
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

      return response;
    } catch (error: Error | { response?: { data?: { detail?: string; message?: string } } }) {
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