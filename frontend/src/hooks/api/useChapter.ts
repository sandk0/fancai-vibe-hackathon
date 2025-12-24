/**
 * React Query хуки для работы с главами книг
 *
 * Интеграция с chapterCache для оптимизации загрузки глав.
 * Кэширует главы в IndexedDB для offline доступа.
 *
 * Особенности:
 * - Двухуровневый кэш: React Query (memory) + IndexedDB (persistent)
 * - Prefetching соседних глав
 * - Автоматическая инвалидация при обновлении книги
 *
 * @module hooks/api/useChapter
 */

import React from 'react';
import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { chapterCache } from '@/services/chapterCache';
import { chapterKeys, descriptionKeys, getCurrentUserId } from './queryKeys';
import type { Chapter, Description } from '@/types/api';

/**
 * Response типа для главы с навигацией
 */
interface ChapterResponse {
  chapter: Chapter;
  descriptions?: Description[];
  navigation: {
    has_previous: boolean;
    has_next: boolean;
    previous_chapter?: number;
    next_chapter?: number;
  };
}

/**
 * Получение конкретной главы книги
 *
 * Сначала проверяет IndexedDB кэш, затем загружает с API.
 * Автоматически prefetch'ит следующую главу для плавной навигации.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useChapter('book-123', 5);
 *
 * if (data) {
 *   console.log('Chapter:', data.chapter.title);
 *   console.log('Descriptions:', data.descriptions?.length);
 *   console.log('Has next:', data.navigation.has_next);
 * }
 * ```
 */
export function useChapter(
  bookId: string,
  chapterNumber: number,
  options?: Omit<UseQueryOptions<ChapterResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  const query = useQuery({
    queryKey: chapterKeys.detail(userId, bookId, chapterNumber),
    queryFn: async () => {
      console.log(
        `📖 [useChapter] Fetching chapter ${chapterNumber} for book ${bookId}`
      );

      // 1. Проверяем IndexedDB кэш
      const cached = await chapterCache.get(bookId, chapterNumber);
      if (cached) {
        console.log(
          `✅ [useChapter] Chapter ${chapterNumber} loaded from IndexedDB cache`
        );

        // Возвращаем данные из кэша
        // Navigation определим по наличию соседних глав в кэше
        // (в реальности нужно хранить navigation в кэше)
        return {
          chapter: {
            id: `${bookId}_${chapterNumber}`,
            book_id: bookId,
            number: chapterNumber,
            title: `Chapter ${chapterNumber}`,
            content: '',
            word_count: 0,
            estimated_reading_time_minutes: 0,
            descriptions: cached.descriptions,
          } as Chapter,
          descriptions: cached.descriptions,
          navigation: {
            has_previous: chapterNumber > 1,
            has_next: true,
            previous_chapter: chapterNumber > 1 ? chapterNumber - 1 : undefined,
            next_chapter: chapterNumber + 1,
          },
        };
      }

      // 2. Загружаем с API
      console.log(
        `📡 [useChapter] Chapter ${chapterNumber} not in cache, fetching from API`
      );
      const response = await booksAPI.getChapter(bookId, chapterNumber);

      // 3. Сохраняем в IndexedDB кэш
      if (response.descriptions) {
        await chapterCache
          .set(bookId, chapterNumber, response.descriptions, [])
          .catch((err) => {
            console.warn(
              `⚠️ [useChapter] Failed to cache chapter ${chapterNumber}:`,
              err
            );
          });
      }

      return response;
    },
    staleTime: 10 * 60 * 1000, // 10 минут - главы редко меняются
    enabled: !!bookId && chapterNumber > 0,
    ...options,
  });

  // Кэшируем descriptions и делаем prefetch в useEffect
  React.useEffect(() => {
    if (query.data?.descriptions) {
      queryClient.setQueryData(
        descriptionKeys.byChapter(userId, bookId, chapterNumber),
        {
          chapter_info: {
            id: query.data.chapter.id,
            number: query.data.chapter.number,
            title: query.data.chapter.title,
            word_count: query.data.chapter.word_count,
            estimated_reading_time_minutes:
              query.data.chapter.estimated_reading_time_minutes,
            is_description_parsed: true,
            descriptions_found: query.data.descriptions.length,
          },
          nlp_analysis: {
            total_descriptions: query.data.descriptions.length,
            by_type: query.data.descriptions.reduce(
              (acc, desc) => {
                acc[desc.type] = (acc[desc.type] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
            descriptions: query.data.descriptions,
          },
          message: 'Descriptions loaded from chapter',
        }
      );
    }

    // Prefetch соседних глав
    if (query.data?.navigation.has_next && query.data?.navigation.next_chapter) {
      const nextChapter = query.data.navigation.next_chapter;
      queryClient.prefetchQuery({
        queryKey: chapterKeys.detail(userId, bookId, nextChapter),
        queryFn: () => booksAPI.getChapter(bookId, nextChapter),
        staleTime: 10 * 60 * 1000,
      });
    }

    if (query.data?.navigation.has_previous && query.data?.navigation.previous_chapter) {
      const prevChapter = query.data.navigation.previous_chapter;
      queryClient.prefetchQuery({
        queryKey: chapterKeys.detail(userId, bookId, prevChapter),
        queryFn: () => booksAPI.getChapter(bookId, prevChapter),
        staleTime: 10 * 60 * 1000,
      });
    }
  }, [query.data, bookId, chapterNumber, queryClient, userId]);

  return query;
}

/**
 * Получение только контента главы (без descriptions)
 *
 * Легковесная версия useChapter для случаев, когда descriptions не нужны.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: chapter, isLoading } = useChapterContent('book-123', 5);
 * ```
 */
export function useChapterContent(
  bookId: string,
  chapterNumber: number,
  options?: Omit<UseQueryOptions<Chapter, Error>, 'queryKey' | 'queryFn'>
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: [...chapterKeys.detail(userId, bookId, chapterNumber), 'content'],
    queryFn: async () => {
      const response = await booksAPI.getChapter(bookId, chapterNumber);
      return response.chapter;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!bookId && chapterNumber > 0,
    ...options,
  });
}

/**
 * Получение навигационной информации главы
 *
 * Для отображения кнопок next/prev без загрузки полного контента.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: navigation } = useChapterNavigation('book-123', 5);
 *
 * return (
 *   <div>
 *     {navigation.has_previous && (
 *       <button onClick={() => goToChapter(navigation.previous_chapter)}>
 *         Previous
 *       </button>
 *     )}
 *     {navigation.has_next && (
 *       <button onClick={() => goToChapter(navigation.next_chapter)}>
 *         Next
 *       </button>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useChapterNavigation(
  bookId: string,
  chapterNumber: number,
  options?: Omit<
    UseQueryOptions<
      {
        has_previous: boolean;
        has_next: boolean;
        previous_chapter?: number;
        next_chapter?: number;
      },
      Error
    >,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: chapterKeys.navigation(userId, bookId, chapterNumber),
    queryFn: async () => {
      const response = await booksAPI.getChapter(bookId, chapterNumber);
      return response.navigation;
    },
    staleTime: 15 * 60 * 1000, // 15 минут - навигация точно не меняется
    enabled: !!bookId && chapterNumber > 0,
    ...options,
  });
}

/**
 * Prefetch главы для предзагрузки
 *
 * Utility функция для ручного prefetch глав.
 * Полезно для предзагрузки нескольких глав заранее.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 *
 * @example
 * ```tsx
 * const prefetchChapter = usePrefetchChapter();
 *
 * // Prefetch следующих 3 глав
 * useEffect(() => {
 *   for (let i = 1; i <= 3; i++) {
 *     prefetchChapter('book-123', currentChapter + i);
 *   }
 * }, [currentChapter]);
 * ```
 */
export function usePrefetchChapter() {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return (bookId: string, chapterNumber: number) => {
    return queryClient.prefetchQuery({
      queryKey: chapterKeys.detail(userId, bookId, chapterNumber),
      queryFn: () => booksAPI.getChapter(bookId, chapterNumber),
      staleTime: 10 * 60 * 1000,
    });
  };
}
