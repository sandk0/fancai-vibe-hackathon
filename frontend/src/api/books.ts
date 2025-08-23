// Books API methods

import { apiClient } from './client';
import type {
  Book,
  BookUploadResponse,
  Chapter,
  PaginationParams,
  ReadingProgress,
  NLPAnalysis,
} from '@/types/api';

export const booksAPI = {
  // Book management
  async getBooks(params?: PaginationParams): Promise<{
    books: Book[];
    total: number;
    skip: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    
    const url = `/books${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    return apiClient.get(url);
  },

  async getBook(bookId: string): Promise<Book> {
    return apiClient.get(`/books/${bookId}`);
  },

  async uploadBook(
    file: File,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<BookUploadResponse> {
    return apiClient.upload('/books/upload', file, onUploadProgress);
  },

  async deleteBook(bookId: string): Promise<{ message: string }> {
    return apiClient.delete(`/books/${bookId}`);
  },

  // Chapters
  async getChapter(bookId: string, chapterNumber: number): Promise<{
    chapter: Chapter;
    descriptions?: any[];
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
    chapter_info: any;
    nlp_analysis: NLPAnalysis;
    message: string;
  }> {
    const params = new URLSearchParams();
    if (extractNew) params.append('extract_new', 'true');
    
    const url = `/books/${bookId}/chapters/${chapterNumber}/descriptions${params.toString() ? '?' + params.toString() : ''}`;
    return apiClient.get(url);
  },

  // Reading progress
  async updateReadingProgress(
    bookId: string,
    data: {
      current_page: number;
      current_chapter: number;
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
    return apiClient.get('/books/statistics');
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
};