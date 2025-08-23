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
  booksPerPage: 12,
  hasMore: true,

  // Actions
  fetchBooks: async (page = 1, limit = 12) => {
    set({ isLoading: true, error: null });

    try {
      const skip = (page - 1) * limit;
      const response = await booksAPI.getBooks({ skip, limit });

      set({
        books: page === 1 ? response.books : [...get().books, ...response.books],
        totalBooks: response.total,
        currentPage: page,
        booksPerPage: limit,
        hasMore: response.books.length === limit,
        isLoading: false,
      });
    } catch (error: any) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to fetch books' 
      });
      throw error;
    }
  },

  fetchBook: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const book = await booksAPI.getBook(bookId);
      set({ 
        currentBook: book,
        isLoading: false 
      });
    } catch (error: any) {
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
    } catch (error: any) {
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
      const response = await booksAPI.uploadBook(file, (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        console.log(`Upload progress: ${percentCompleted}%`);
      });

      // Refresh books list
      await get().fetchBooks(1, get().booksPerPage);

      set({ isLoading: false });
      return response;
    } catch (error: any) {
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
    } catch (error: any) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to delete book' 
      });
      throw error;
    }
  },

  updateReadingProgress: async (bookId: string, currentPage: number, chapterNumber: number) => {
    try {
      const response = await booksAPI.updateReadingProgress(bookId, {
        current_page: currentPage,
        current_chapter: chapterNumber,
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
    } catch (error: any) {
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