/**
 * Тесты для Books Zustand Store
 *
 * Проверяем состояние и actions для управления книгами.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBooksStore } from '../books';
import { booksAPI } from '@/api/books';
import type { Book, BookDetail } from '@/types/api';

// Mock booksAPI
vi.mock('@/api/books', () => ({
  booksAPI: {
    getBooks: vi.fn(),
    getBook: vi.fn(),
    getChapter: vi.fn(),
    deleteBook: vi.fn(),
  },
}));

// Helper function to create complete Book mock
const createMockBook = (partial: Partial<Book>): Book => ({
  id: '1',
  title: 'Mock Book',
  author: 'Mock Author',
  genre: 'fiction',
  language: 'ru',
  total_pages: 200,
  estimated_reading_time_hours: 5,
  chapters_count: 10,
  reading_progress_percent: 0,
  has_cover: false,
  is_parsed: true,
  created_at: new Date().toISOString(),
  ...partial,
});

describe('Books Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useBooksStore.setState({
      books: [],
      currentBook: null,
      currentChapter: null,
      isLoading: false,
      error: null,
      totalBooks: 0,
      currentPage: 1,
      booksPerPage: 12,
      hasMore: true,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useBooksStore());

      expect(result.current.books).toEqual([]);
      expect(result.current.currentBook).toBeNull();
      expect(result.current.currentChapter).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.totalBooks).toBe(0);
      expect(result.current.currentPage).toBe(1);
    });
  });

  describe('fetchBooks', () => {
    it('should fetch books successfully', async () => {
      const mockBooks: Book[] = [
        createMockBook({ id: '1', title: 'Book 1', author: 'Author 1', genre: 'fiction' }),
        createMockBook({ id: '2', title: 'Book 2', author: 'Author 2', genre: 'mystery' }),
      ];

      const mockResponse = {
        books: mockBooks,
        total: 20,
        skip: 0,
        limit: 12,
      };

      vi.mocked(booksAPI.getBooks).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.fetchBooks(1, 12);
      });

      expect(result.current.books).toEqual(mockBooks);
      expect(result.current.totalBooks).toBe(20);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should set loading state while fetching', async () => {
      vi.mocked(booksAPI.getBooks).mockImplementation(
        () => new Promise<{ books: Book[]; total: number; skip: number; limit: number }>((resolve) =>
          setTimeout(() => resolve({ books: [], total: 0, skip: 0, limit: 12 }), 100)
        )
      );

      const { result } = renderHook(() => useBooksStore());

      act(() => {
        result.current.fetchBooks(1, 12);
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should handle fetch error', async () => {
      const errorMessage = 'Failed to fetch books';
      vi.mocked(booksAPI.getBooks).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        try {
          await result.current.fetchBooks(1, 12);
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isLoading).toBe(false);
    });

    it('should append books on pagination', async () => {
      const firstPageBooks: Book[] = [
        createMockBook({ id: '1', title: 'Book 1', author: 'Author 1', genre: 'fiction' }),
      ];
      const secondPageBooks: Book[] = [
        createMockBook({ id: '2', title: 'Book 2', author: 'Author 2', genre: 'mystery' }),
      ];

      // First page
      vi.mocked(booksAPI.getBooks).mockResolvedValueOnce({
        books: firstPageBooks,
        total: 20,
        skip: 0,
        limit: 1,
      });

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.fetchBooks(1, 1);
      });

      expect(result.current.books).toHaveLength(1);

      // Second page
      vi.mocked(booksAPI.getBooks).mockResolvedValueOnce({
        books: secondPageBooks,
        total: 20,
        skip: 1,
        limit: 1,
      });

      await act(async () => {
        await result.current.fetchBooks(2, 1);
      });

      expect(result.current.books).toHaveLength(2);
      expect(result.current.books[0].id).toBe('1');
      expect(result.current.books[1].id).toBe('2');
    });

    it('should replace books when fetching first page', async () => {
      // Set initial state with books
      useBooksStore.setState({
        books: [createMockBook({ id: 'old', title: 'Old Book', author: 'Old Author' })],
      });

      const newBooks: Book[] = [
        createMockBook({ id: 'new', title: 'New Book', author: 'New Author' }),
      ];

      vi.mocked(booksAPI.getBooks).mockResolvedValue({
        books: newBooks,
        total: 1,
        skip: 0,
        limit: 12,
      });

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.fetchBooks(1, 12);
      });

      expect(result.current.books).toEqual(newBooks);
      expect(result.current.books).toHaveLength(1);
      expect(result.current.books[0].id).toBe('new');
    });
  });

  describe('fetchBook', () => {
    it('should fetch single book', async () => {
      const mockBook: BookDetail = {
        id: '123',
        title: 'Test Book',
        author: 'Test Author',
        genre: 'fiction',
        language: 'ru',
        total_pages: 300,
        is_parsed: true,
        total_chapters: 25,
        estimated_reading_time_hours: 150,
        chapters_count: 25,
        reading_progress_percent: 0,
        has_cover: false,
        created_at: new Date().toISOString(),
        chapters: [],
        reading_progress: {
          current_chapter: 1,
          current_page: 0,
          current_position: 0,
          progress_percent: 0,
        },
        file_format: 'epub',
        file_size_mb: 1.5,
        parsing_progress: 100,
      };

      vi.mocked(booksAPI.getBook).mockResolvedValue(mockBook);

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.fetchBook('123');
      });

      expect(result.current.currentBook).toEqual(mockBook);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle fetch book error', async () => {
      vi.mocked(booksAPI.getBook).mockRejectedValue(new Error('Book not found'));

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        try {
          await result.current.fetchBook('nonexistent');
        } catch (error) {
          // Expected
        }
      });

      expect(result.current.error).toBe('Book not found');
      expect(result.current.currentBook).toBeNull();
    });
  });

  describe('fetchChapter', () => {
    it('should fetch chapter successfully', async () => {
      const mockChapter = {
        id: 'ch-1',
        book_id: 'book-1',
        number: 1,
        title: 'Chapter 1',
        content: 'Chapter content',
        word_count: 100,
        estimated_reading_time_minutes: 5,
      };

      const mockResponse = {
        chapter: mockChapter,
        descriptions: [],
        navigation: {
          has_previous: false,
          has_next: true,
          next_chapter: 2,
        },
      };

      vi.mocked(booksAPI.getChapter).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.fetchChapter('book-1', 1);
      });

      expect(result.current.currentChapter).toEqual(mockChapter);
    });

    it('should return full response including navigation', async () => {
      const mockResponse = {
        chapter: {
          id: 'ch-1',
          book_id: 'book-1',
          number: 5,
          title: 'Chapter 5',
          content: 'Content',
          word_count: 50,
          estimated_reading_time_minutes: 3,
        },
        descriptions: [],
        navigation: {
          has_previous: true,
          has_next: true,
          previous_chapter: 4,
          next_chapter: 6,
        },
      };

      vi.mocked(booksAPI.getChapter).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useBooksStore());

      let response: typeof mockResponse | undefined;
      await act(async () => {
        response = await result.current.fetchChapter('book-1', 5);
      });

      expect(response).toEqual(mockResponse);
      expect(response?.navigation.has_previous).toBe(true);
      expect(response?.navigation.has_next).toBe(true);
    });
  });

  describe('refreshBooks', () => {
    it('should refresh books with current page and limit', async () => {
      useBooksStore.setState({
        currentPage: 2,
        booksPerPage: 10,
      });

      vi.mocked(booksAPI.getBooks).mockResolvedValue({
        books: [],
        total: 0,
        skip: 10,
        limit: 10,
      });

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.refreshBooks();
      });

      expect(booksAPI.getBooks).toHaveBeenCalledWith({
        skip: 10, // (page 2 - 1) * 10
        limit: 10,
      });
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      useBooksStore.setState({ error: 'Some error' });

      const { result } = renderHook(() => useBooksStore());

      act(() => {
        result.current.clearError?.();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('hasMore flag', () => {
    it('should set hasMore to false when fewer books returned than limit', async () => {
      vi.mocked(booksAPI.getBooks).mockResolvedValue({
        books: [
          createMockBook({ id: '1', title: 'Book 1', author: 'Author' }),
        ],
        total: 1,
        skip: 0,
        limit: 12, // Limit is 12 but only 1 book returned
      });

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.fetchBooks(1, 12);
      });

      expect(result.current.hasMore).toBe(false);
    });

    it('should set hasMore to true when full page returned', async () => {
      const fullPageBooks: Book[] = Array.from({ length: 12 }, (_, i) =>
        createMockBook({
          id: `${i}`,
          title: `Book ${i}`,
          author: 'Author',
        })
      );

      vi.mocked(booksAPI.getBooks).mockResolvedValue({
        books: fullPageBooks,
        total: 50,
        skip: 0,
        limit: 12,
      });

      const { result } = renderHook(() => useBooksStore());

      await act(async () => {
        await result.current.fetchBooks(1, 12);
      });

      expect(result.current.hasMore).toBe(true);
    });
  });
});
