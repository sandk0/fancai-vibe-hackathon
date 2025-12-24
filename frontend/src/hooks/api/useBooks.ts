/**
 * React Query хуки для работы с книгами
 *
 * Обеспечивает кэширование, автоматическое обновление и оптимистичные обновления
 * для всех операций с книгами.
 *
 * Особенности:
 * - Автоматический кэш с настраиваемым staleTime
 * - Оптимистичные обновления для лучшего UX
 * - Интеграция с чистящими функциями кэша (chapterCache, imageCache)
 * - Prefetching для следующих страниц
 *
 * @module hooks/api/useBooks
 */

import React from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  type UseQueryOptions,
  type UseMutationOptions,
  type UseInfiniteQueryOptions,
} from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { chapterCache } from '@/services/chapterCache';
import { imageCache } from '@/services/imageCache';
import { bookKeys, queryKeyUtils, getCurrentUserId } from './queryKeys';
import type {
  Book,
  BookDetail,
  BookUploadResponse,
  PaginationParams,
  ReadingProgress,
  UserReadingStatistics,
} from '@/types/api';

/**
 * Параметры для списка книг
 */
interface BooksListParams extends PaginationParams {
  sort_by?: string;
}

/**
 * Получение списка книг с пагинацией
 *
 * @param params - Параметры пагинации и сортировки
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useBooks({
 *   skip: 0,
 *   limit: 10,
 *   sort_by: 'created_desc'
 * });
 * ```
 */
export function useBooks(
  params?: BooksListParams,
  options?: Omit<
    UseQueryOptions<
      {
        books: Book[];
        total: number;
        skip: number;
        limit: number;
      },
      Error
    >,
    'queryKey' | 'queryFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  const query = useQuery({
    queryKey: bookKeys.list(userId, params),
    queryFn: () => booksAPI.getBooks(params),
    staleTime: 30 * 1000, // 30 секунд - список обновляется довольно часто
    ...options,
  });

  // Prefetch следующей страницы после успешной загрузки
  React.useEffect(() => {
    if (query.data) {
      const nextSkip = (params?.skip || 0) + (params?.limit || 10);
      if (nextSkip < query.data.total) {
        queryClient.prefetchQuery({
          queryKey: bookKeys.list(userId, {
            ...params,
            skip: nextSkip,
          }),
          queryFn: () =>
            booksAPI.getBooks({
              ...params,
              skip: nextSkip,
            }),
        });
      }
    }
  }, [query.data, params, queryClient, userId]);

  return query;
}

/**
 * Получение списка книг с infinite scroll
 *
 * @param params - Базовые параметры (limit, sort_by)
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage
 * } = useBooksInfinite({ limit: 20, sort_by: 'created_desc' });
 * ```
 */
export function useBooksInfinite(
  params?: Omit<BooksListParams, 'skip'>,
  options?: Omit<
    UseInfiniteQueryOptions<
      {
        books: Book[];
        total: number;
        skip: number;
        limit: number;
      },
      Error
    >,
    'queryKey' | 'queryFn' | 'getNextPageParam' | 'initialPageParam'
  >
) {
  const userId = getCurrentUserId();

  return useInfiniteQuery({
    queryKey: bookKeys.list(userId, params),
    queryFn: ({ pageParam }) =>
      booksAPI.getBooks({
        ...params,
        skip: pageParam as number,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextSkip = lastPage.skip + lastPage.limit;
      return nextSkip < lastPage.total ? nextSkip : undefined;
    },
    staleTime: 30 * 1000,
    ...options,
  });
}

/**
 * Получение деталей конкретной книги
 *
 * @param bookId - ID книги
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: book, isLoading } = useBook('book-123');
 * ```
 */
export function useBook(
  bookId: string,
  options?: Omit<UseQueryOptions<BookDetail, Error>, 'queryKey' | 'queryFn'>
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: bookKeys.detail(userId, bookId),
    queryFn: () => booksAPI.getBook(bookId),
    staleTime: 5 * 60 * 1000, // 5 минут - детали книги меняются редко
    enabled: !!bookId, // Не запускать, если нет ID
    ...options,
  });
}

/**
 * Получение прогресса чтения книги
 *
 * @param bookId - ID книги
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: progress } = useReadingProgress('book-123');
 * ```
 */
export function useReadingProgress(
  bookId: string,
  options?: Omit<
    UseQueryOptions<{ progress: ReadingProgress | null }, Error>,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: bookKeys.progress(userId, bookId),
    queryFn: () => booksAPI.getReadingProgress(bookId),
    staleTime: 60 * 1000, // 1 минута - прогресс обновляется часто
    enabled: !!bookId,
    ...options,
  });
}

/**
 * Получение статистики чтения пользователя
 *
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: stats } = useUserStatistics();
 * ```
 */
export function useUserStatistics(
  options?: Omit<
    UseQueryOptions<UserReadingStatistics, Error>,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: bookKeys.statistics(userId),
    queryFn: async () => {
      const data = await booksAPI.getUserReadingStatistics();
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 минуты
    ...options,
  });
}

/**
 * Мутация загрузки новой книги
 *
 * @param options - Опции мутации
 *
 * @example
 * ```tsx
 * const uploadMutation = useUploadBook();
 *
 * const handleUpload = async (file: File) => {
 *   try {
 *     const book = await uploadMutation.mutateAsync(file);
 *     console.log('Книга загружена:', book);
 *   } catch (error) {
 *     console.error('Ошибка загрузки:', error);
 *   }
 * };
 * ```
 */
export function useUploadBook(
  options?: Omit<
    UseMutationOptions<
      BookUploadResponse,
      Error,
      {
        file: File;
        onProgress?: (percent: number) => void;
      }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: async ({ file, onProgress }) => {
      const formData = new FormData();
      formData.append('file', file);

      return booksAPI.uploadBook(formData, {
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          onProgress?.(percent);
        },
      });
    },
    onSuccess: (data) => {
      // Инвалидация списка книг и статистики
      queryKeyUtils.invalidateAfterUpload(userId).forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Сразу добавляем книгу в кэш деталей
      queryClient.setQueryData(bookKeys.detail(userId, data.book.id), data.book);
    },
    ...options,
  });
}

/**
 * Мутация удаления книги
 *
 * @param options - Опции мутации
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteBook();
 *
 * const handleDelete = async (bookId: string) => {
 *   if (confirm('Удалить книгу?')) {
 *     await deleteMutation.mutateAsync(bookId);
 *   }
 * };
 * ```
 */
export function useDeleteBook(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      string,
      { previousBooks: unknown }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: (bookId: string) => booksAPI.deleteBook(bookId),
    onMutate: async (bookId): Promise<{ previousBooks: unknown }> => {
      // Cancel outgoing queries - use bookKeys.all(userId) to cancel ALL user's book queries
      await queryClient.cancelQueries({ queryKey: bookKeys.all(userId) });

      // Snapshot previous state для rollback
      const previousBooks = queryClient.getQueryData(bookKeys.list(userId));

      // Оптимистичное удаление из списка - update ALL list queries for this user
      queryClient.setQueriesData<{
        books: Book[];
        total: number;
        skip: number;
        limit: number;
      }>({ queryKey: bookKeys.all(userId) }, (old) => {
        if (!old) return old;
        return {
          ...old,
          books: old.books.filter((book) => book.id !== bookId),
          total: old.total - 1,
        };
      });

      return { previousBooks };
    },
    onSuccess: async (_data, bookId) => {
      // Очистка кэшей глав и изображений
      console.log('🗑️ [useDeleteBook] Clearing caches for book:', bookId);
      await Promise.all([
        chapterCache.clearBook(userId, bookId),
        imageCache.clearBook(userId, bookId),
      ]).catch((err) => {
        console.warn('⚠️ [useDeleteBook] Error clearing caches:', err);
      });

      // Инвалидация всех связанных запросов
      queryKeyUtils.invalidateAfterDelete(userId, bookId).forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    onError: (_error, _bookId, context) => {
      // Rollback на предыдущее состояние
      if (context?.previousBooks) {
        queryClient.setQueryData(bookKeys.list(userId), context.previousBooks);
      }
    },
    ...options,
  });
}

/**
 * Мутация обновления прогресса чтения
 *
 * @param options - Опции мутации
 *
 * @example
 * ```tsx
 * const updateProgressMutation = useUpdateReadingProgress();
 *
 * const handleProgressUpdate = async () => {
 *   await updateProgressMutation.mutateAsync({
 *     bookId: 'book-123',
 *     current_chapter: 5,
 *     current_position_percent: 75,
 *     reading_location_cfi: 'epubcfi(...)',
 *   });
 * };
 * ```
 */
export function useUpdateReadingProgress(
  options?: Omit<
    UseMutationOptions<
      {
        progress: ReadingProgress;
        message: string;
      },
      Error,
      {
        bookId: string;
        current_chapter: number;
        current_position_percent: number;
        reading_location_cfi?: string;
        scroll_offset_percent?: number;
      },
      { previousProgress: unknown }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: ({ bookId, ...data }) =>
      booksAPI.updateReadingProgress(bookId, data),
    onMutate: async ({ bookId, ...newProgress }): Promise<{ previousProgress: unknown }> => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: bookKeys.progress(userId, bookId) });

      // Snapshot
      const previousProgress = queryClient.getQueryData(
        bookKeys.progress(userId, bookId)
      );

      // Оптимистичное обновление
      queryClient.setQueryData(bookKeys.progress(userId, bookId), {
        progress: {
          book_id: bookId,
          current_chapter: newProgress.current_chapter,
          current_position: newProgress.current_position_percent,
          reading_location_cfi: newProgress.reading_location_cfi,
          scroll_offset_percent: newProgress.scroll_offset_percent,
          progress_percent: 0, // Будет пересчитано на бэкенде
          current_page: 0,
          last_read_at: new Date().toISOString(),
        },
      });

      return { previousProgress };
    },
    onSuccess: (data, variables) => {
      // Обновляем кэш прогресса
      queryClient.setQueryData(bookKeys.progress(userId, variables.bookId), data);

      // Обновляем процент прогресса в деталях книги
      queryClient.setQueryData<BookDetail>(
        bookKeys.detail(userId, variables.bookId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            reading_progress: {
              ...old.reading_progress,
              current_chapter: data.progress.current_chapter,
              current_position: data.progress.current_position,
              reading_location_cfi: data.progress.reading_location_cfi,
              progress_percent: data.progress.progress_percent,
            },
          };
        }
      );

      // Обновляем процент в списке книг
      queryClient.setQueriesData<{
        books: Book[];
        total: number;
        skip: number;
        limit: number;
      }>({ queryKey: bookKeys.all(userId) }, (old) => {
        if (!old) return old;
        return {
          ...old,
          books: old.books.map((book) =>
            book.id === variables.bookId
              ? { ...book, reading_progress_percent: data.progress.progress_percent }
              : book
          ),
        };
      });

      // Также инвалидируем статистику пользователя
      queryClient.invalidateQueries({ queryKey: bookKeys.statistics(userId) });
    },
    onError: (_error, variables, context) => {
      // Rollback
      if (context?.previousProgress) {
        queryClient.setQueryData(
          bookKeys.progress(userId, variables.bookId),
          context.previousProgress
        );
      }
    },
    ...options,
  });
}

/**
 * Получение URL файла книги для EPUB reader
 *
 * @param bookId - ID книги
 * @returns URL файла
 *
 * @example
 * ```tsx
 * const bookFileUrl = useBookFileUrl('book-123');
 * ```
 */
export function useBookFileUrl(bookId: string): string {
  return booksAPI.getBookFileUrl(bookId);
}
