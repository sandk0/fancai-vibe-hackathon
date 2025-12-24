// Books API methods

import { apiClient } from './client';
import type {
  Book,
  BookDetail,
  BookUploadResponse,
  Chapter,
  ChapterInfo,
  PaginationParams,
  ReadingProgress,
  NLPAnalysis,
  Description,
  UserReadingStatistics,
} from '@/types/api';

export const booksAPI = {
  // Parsing status
  async getParsingStatus(bookId: string) {
    return apiClient.get(`/books/${bookId}/parsing-status`);
  },

  // Start book processing
  async processBook(bookId: string) {
    return apiClient.post(`/books/${bookId}/process`);
  },

  // Book management
  async getBooks(params?: PaginationParams & { sort_by?: string }): Promise<{
    books: Book[];
    total: number;
    skip: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    if (params?.sort_by) searchParams.append('sort_by', params.sort_by);

    // Always use trailing slash - backend has redirect_slashes=False
    const queryString = searchParams.toString();
    const url = `/books/${queryString ? '?' + queryString : ''}`;
    return apiClient.get(url);
  },

  async getBook(bookId: string): Promise<BookDetail> {
    return apiClient.get(`/books/${bookId}`);
  },

  async uploadBook(
    formData: FormData,
    config?: { onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void }
  ): Promise<BookUploadResponse> {
    console.log('📡 [API] uploadBook called');
    console.log('📡 [API] FormData has entries:', Array.from(formData.entries()).length);
    console.log('📡 [API] Config:', config);

    // ВАЖНО: НЕ устанавливаем Content-Type вообще!
    // Когда axios видит FormData, он автоматически удаляет Content-Type
    // и позволяет браузеру установить правильный multipart/form-data с boundary
    const requestConfig = {
      ...config,
      headers: {
        'Content-Type': undefined, // Let browser set multipart/form-data with boundary
      },
    };

    try {
      console.log('📡 [API] Making POST request to /books/upload...');
      const response = await apiClient.client.post('/books/upload', formData, requestConfig);
      console.log('📡 [API] Response received:', response.status, response.statusText);
      console.log('📡 [API] Response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('📡 [API] Upload request failed:', error);
      throw error;
    }
  },

  async deleteBook(bookId: string): Promise<{ message: string }> {
    return apiClient.delete(`/books/${bookId}`);
  },

  // Chapters
  async getChapter(bookId: string, chapterNumber: number): Promise<{
    chapter: Chapter;
    descriptions?: Description[];
    navigation: {
      has_previous: boolean;
      has_next: boolean;
      previous_chapter?: number;
      next_chapter?: number;
    };
  }> {
    return apiClient.get(`/books/${bookId}/chapters/${chapterNumber}`);
  },

  async getChapterDescriptions(
    bookId: string,
    chapterNumber: number,
    extractNew: boolean = false
  ): Promise<{
    chapter_info: ChapterInfo;
    nlp_analysis: NLPAnalysis;
    message: string;
  }> {
    const params = new URLSearchParams();
    if (extractNew) params.append('extract_new', 'true');

    const url = `/books/${bookId}/chapters/${chapterNumber}/descriptions${params.toString() ? '?' + params.toString() : ''}`;
    return apiClient.get(url);
  },

  /**
   * Get descriptions for multiple chapters in a single request.
   * OPTIMIZATION (Phase 3): Reduces N API calls to 1 for prefetching.
   * Note: Does NOT trigger LLM extraction - only returns existing descriptions.
   *
   * @param bookId - Book ID
   * @param chapterNumbers - Array of chapter numbers to fetch (max 10)
   * @returns Batch response with descriptions for each chapter
   */
  async getBatchDescriptions(
    bookId: string,
    chapterNumbers: number[]
  ): Promise<{
    book_id: string;
    chapters: Array<{
      chapter_number: number;
      success: boolean;
      data?: {
        chapter_info: ChapterInfo;
        nlp_analysis: NLPAnalysis;
        message: string;
      };
      error?: string;
    }>;
    total_requested: number;
    total_success: number;
    total_descriptions: number;
  }> {
    return apiClient.post(`/books/${bookId}/chapters/batch`, {
      chapter_numbers: chapterNumbers,
    });
  },

  // Reading progress
  async updateReadingProgress(
    bookId: string,
    data: {
      current_chapter: number;
      current_position_percent: number;
      reading_location_cfi?: string;
      scroll_offset_percent?: number;
    }
  ): Promise<{
    progress: ReadingProgress;
    message: string;
  }> {
    return apiClient.post(`/books/${bookId}/progress`, data);
  },

  async getReadingProgress(bookId: string): Promise<{
    progress: ReadingProgress | null;
  }> {
    return apiClient.get(`/books/${bookId}/progress`);
  },

  async updateProgress(
    bookId: string,
    data: {
      chapter_number: number;
      position_percent_in_chapter: number;
      reading_location_cfi?: string;
    }
  ): Promise<{
    progress: ReadingProgress;
    message: string;
  }> {
    return apiClient.post(`/books/${bookId}/progress`, {
      current_chapter: data.chapter_number,
      current_position_percent: Math.max(0, Math.min(100, data.position_percent_in_chapter)),
      reading_location_cfi: data.reading_location_cfi,
    });
  },

  // Statistics
  async getUserStatistics(): Promise<{
    statistics: {
      total_books: number;
      books_in_progress: number;
      books_completed: number;
      total_chapters_read: number;
      total_reading_time_minutes: number;
      average_reading_speed_wpm: number;
      favorite_genres: string[];
      reading_streak_days: number;
    };
  }> {
    return apiClient.get('/users/reading-statistics');
  },

  // Detailed reading statistics with weekly activity
  async getUserReadingStatistics(): Promise<UserReadingStatistics> {
    const response = await apiClient.get('/users/reading-statistics') as { statistics: UserReadingStatistics };
    return response.statistics;
  },

  // Book file validation and preview
  async validateBookFile(file: File): Promise<{
    filename: string;
    file_size_bytes: number;
    file_size_mb: number;
    validation: {
      is_valid: boolean;
      format: string;
      issues: string[];
      warnings: string[];
    };
    message: string;
  }> {
    return apiClient.upload('/books/validate-file', file);
  },

  async getBookPreview(file: File): Promise<{
    metadata: {
      title: string;
      author: string;
      language: string;
      genre: string;
      description: string;
      publisher: string;
      publish_date: string;
      has_cover: boolean;
    };
    statistics: {
      total_chapters: number;
      total_pages: number;
      estimated_reading_time_hours: number;
      file_format: string;
      file_size_mb: number;
    };
    chapters_preview: Array<{
      number: number;
      title: string;
      content_preview: string;
      word_count: number;
      estimated_reading_time_minutes: number;
    }>;
    message: string;
  }> {
    return apiClient.upload('/books/parse-preview', file);
  },

  // Book parser status
  async getParserStatus(): Promise<{
    supported_formats: string[];
    nlp_available: boolean;
    parser_ready: boolean;
    max_file_size_mb: number;
    message: string;
  }> {
    return apiClient.get('/books/parser-status');
  },

  // Chapter analysis
  async analyzeChapter(file: File, chapterNumber: number = 1): Promise<{
    chapter_info: {
      number: number;
      title: string;
      word_count: number;
      content_preview: string;
    };
    nlp_analysis: NLPAnalysis;
    message: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chapter_number', chapterNumber.toString());

    return apiClient.post('/books/analyze-chapter', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Get book file for epub.js reader
  getBookFileUrl(bookId: string): string {
    // Возвращает URL для скачивания EPUB файла
    const baseUrl = apiClient.client.defaults.baseURL || '';
    return `${baseUrl}/books/${bookId}/file`;
  },
};