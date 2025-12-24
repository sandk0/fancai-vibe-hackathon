/**
 * React Query хуки для работы с описаниями
 *
 * Описания извлекаются из текста книг с помощью NLP системы
 * и используются для генерации изображений.
 *
 * Особенности:
 * - Кэширование descriptions вместе с главами (chapterCache)
 * - Фильтрация по типам (location, character, atmosphere, etc.)
 * - Интеграция с NLP анализом
 *
 * @module hooks/api/useDescriptions
 */

import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { chapterCache } from '@/services/chapterCache';
import { descriptionKeys, getCurrentUserId } from './queryKeys';
import type {
  Description,
  NLPAnalysis,
  ChapterInfo,
  DescriptionType,
} from '@/types/api';

/**
 * Response типа для описаний главы
 */
interface ChapterDescriptionsResponse {
  chapter_info: ChapterInfo;
  nlp_analysis: NLPAnalysis;
  message: string;
}

/**
 * Получение описаний для конкретной главы
 *
 * Сначала проверяет IndexedDB кэш (chapterCache),
 * затем загружает с API если нужно.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useChapterDescriptions('book-123', 5);
 *
 * if (data) {
 *   console.log('Total descriptions:', data.nlp_analysis.total_descriptions);
 *   console.log('By type:', data.nlp_analysis.by_type);
 * }
 * ```
 */
export function useChapterDescriptions(
  bookId: string,
  chapterNumber: number,
  options?: Omit<
    UseQueryOptions<ChapterDescriptionsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: descriptionKeys.byChapter(userId, bookId, chapterNumber),
    queryFn: async () => {
      console.log(
        `📝 [useChapterDescriptions] Fetching descriptions for chapter ${chapterNumber}`
      );

      // 1. Проверяем chapterCache
      const cached = await chapterCache.get(bookId, chapterNumber);
      if (cached && cached.descriptions.length > 0) {
        console.log(
          `✅ [useChapterDescriptions] Descriptions loaded from cache: ${cached.descriptions.length}`
        );

        // Формируем ответ из кэша
        const byType = cached.descriptions.reduce(
          (acc, desc) => {
            acc[desc.type] = (acc[desc.type] || 0) + 1;
            return acc;
          },
          {} as Record<DescriptionType, number>
        );

        return {
          chapter_info: {
            id: `${bookId}_${chapterNumber}`,
            number: chapterNumber,
            title: `Chapter ${chapterNumber}`,
            word_count: 0,
            estimated_reading_time_minutes: 0,
            is_description_parsed: true,
            descriptions_found: cached.descriptions.length,
          },
          nlp_analysis: {
            total_descriptions: cached.descriptions.length,
            by_type: byType,
            descriptions: cached.descriptions,
          },
          message: 'Descriptions loaded from cache',
        };
      }

      // 2. Загружаем с API (сначала проверяем существующие)
      console.log(
        `📡 [useChapterDescriptions] Descriptions not in cache, fetching from API`
      );
      let response = await booksAPI.getChapterDescriptions(
        bookId,
        chapterNumber,
        false // extract_new = false, сначала проверяем существующие
      );

      // 3. Если описаний нет - извлекаем через LLM (on-demand extraction)
      if (response.nlp_analysis.descriptions.length === 0) {
        console.log(
          `🔄 [useChapterDescriptions] No descriptions found, extracting via LLM...`
        );
        response = await booksAPI.getChapterDescriptions(
          bookId,
          chapterNumber,
          true // extract_new = true, запускаем LLM extraction
        );
        console.log(
          `✅ [useChapterDescriptions] LLM extracted ${response.nlp_analysis.descriptions.length} descriptions`
        );
      }

      // 4. Сохраняем в кэш
      if (response.nlp_analysis.descriptions.length > 0) {
        await chapterCache
          .set(bookId, chapterNumber, response.nlp_analysis.descriptions, [])
          .catch((err) => {
            console.warn(
              `⚠️ [useChapterDescriptions] Failed to cache descriptions:`,
              err
            );
          });
      }

      return response;
    },
    staleTime: 15 * 60 * 1000, // 15 минут - descriptions редко меняются
    enabled: !!bookId && chapterNumber > 0,
    ...options,
  });
}

/**
 * Получение только массива descriptions (без metadata)
 *
 * Легковесная версия для случаев, когда нужен только список описаний.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: descriptions } = useDescriptionsList('book-123', 5);
 *
 * descriptions?.forEach(desc => {
 *   console.log(`${desc.type}: ${desc.content}`);
 * });
 * ```
 */
export function useDescriptionsList(
  bookId: string,
  chapterNumber: number,
  options?: Omit<UseQueryOptions<Description[], Error>, 'queryKey' | 'queryFn'>
) {
  const userId = getCurrentUserId();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: [...descriptionKeys.byChapter(userId, bookId, chapterNumber), 'list'],
    queryFn: async () => {
      // Используем данные из основного query если есть
      const cachedData = queryClient.getQueryData<ChapterDescriptionsResponse>(
        descriptionKeys.byChapter(userId, bookId, chapterNumber)
      );

      if (cachedData && cachedData.nlp_analysis.descriptions.length > 0) {
        return cachedData.nlp_analysis.descriptions;
      }

      // Иначе загружаем
      let response = await booksAPI.getChapterDescriptions(
        bookId,
        chapterNumber,
        false
      );

      // Если пусто - извлекаем через LLM
      if (response.nlp_analysis.descriptions.length === 0) {
        response = await booksAPI.getChapterDescriptions(
          bookId,
          chapterNumber,
          true // extract_new = true
        );
      }

      return response.nlp_analysis.descriptions;
    },
    staleTime: 15 * 60 * 1000,
    enabled: !!bookId && chapterNumber > 0,
    ...options,
  });
}

/**
 * Фильтрация descriptions по типу
 *
 * Utility хук для получения только определенных типов описаний.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param types - Массив типов для фильтрации
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: locationDescriptions } = useDescriptionsByType(
 *   'book-123',
 *   5,
 *   ['location', 'atmosphere']
 * );
 * ```
 */
export function useDescriptionsByType(
  bookId: string,
  chapterNumber: number,
  types: DescriptionType[],
  options?: Omit<UseQueryOptions<Description[], Error>, 'queryKey' | 'queryFn'>
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: [
      ...descriptionKeys.byChapter(userId, bookId, chapterNumber),
      'filtered',
      types,
    ],
    queryFn: async () => {
      const response = await booksAPI.getChapterDescriptions(
        bookId,
        chapterNumber,
        false
      );
      return response.nlp_analysis.descriptions.filter((desc) =>
        types.includes(desc.type)
      );
    },
    staleTime: 15 * 60 * 1000,
    enabled: !!bookId && chapterNumber > 0 && types.length > 0,
    ...options,
  });
}

/**
 * Получение NLP анализа главы
 *
 * Статистика по типам описаний и общая информация.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: analysis } = useNLPAnalysis('book-123', 5);
 *
 * if (analysis) {
 *   console.log('Total:', analysis.total_descriptions);
 *   console.log('Locations:', analysis.by_type.location);
 *   console.log('Characters:', analysis.by_type.character);
 * }
 * ```
 */
export function useNLPAnalysis(
  bookId: string,
  chapterNumber: number,
  options?: Omit<UseQueryOptions<NLPAnalysis, Error>, 'queryKey' | 'queryFn'>
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: descriptionKeys.nlpAnalysis(userId, bookId, chapterNumber),
    queryFn: async () => {
      const response = await booksAPI.getChapterDescriptions(
        bookId,
        chapterNumber,
        false
      );
      return response.nlp_analysis;
    },
    staleTime: 15 * 60 * 1000,
    enabled: !!bookId && chapterNumber > 0,
    ...options,
  });
}

/**
 * Получение всех описаний книги (все главы)
 *
 * ВНИМАНИЕ: Может быть тяжелым для больших книг.
 * Используйте с осторожностью.
 *
 * @param bookId - ID книги
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: allDescriptions } = useBookDescriptions('book-123');
 *
 * // Общее количество описаний в книге
 * const totalCount = allDescriptions?.reduce(
 *   (sum, chapter) => sum + chapter.descriptions.length,
 *   0
 * );
 * ```
 */
export function useBookDescriptions(
  bookId: string,
  options?: Omit<
    UseQueryOptions<
      Array<{
        chapterNumber: number;
        descriptions: Description[];
      }>,
      Error
    >,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: descriptionKeys.byBook(userId, bookId),
    queryFn: async () => {
      // Для этого нужен отдельный API endpoint
      // Пока возвращаем пустой массив
      // TODO: Добавить batch endpoint на backend
      console.warn(
        '⚠️ [useBookDescriptions] Not implemented - need batch API endpoint'
      );
      return [];
    },
    staleTime: 30 * 60 * 1000, // 30 минут
    enabled: false, // Отключено до реализации backend endpoint
    ...options,
  });
}

/**
 * Принудительная переэкстракция описаний главы
 *
 * Запускает NLP анализ заново для главы.
 * Полезно при обновлении NLP модели или исправлении ошибок.
 *
 * @param bookId - ID книги
 * @param chapterNumber - Номер главы
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data, refetch, isLoading } = useReextractDescriptions('book-123', 5);
 *
 * const handleReextract = () => {
 *   refetch(); // Запускает переэкстракцию
 * };
 * ```
 */
export function useReextractDescriptions(
  bookId: string,
  chapterNumber: number,
  options?: Omit<
    UseQueryOptions<ChapterDescriptionsResponse, Error>,
    'queryKey' | 'queryFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: [
      ...descriptionKeys.byChapter(userId, bookId, chapterNumber),
      'reextract',
    ],
    queryFn: async () => {
      console.log(
        `🔄 [useReextractDescriptions] Re-extracting descriptions for chapter ${chapterNumber}`
      );

      const response = await booksAPI.getChapterDescriptions(
        bookId,
        chapterNumber,
        true // extract_new = true
      );

      // Обновляем основной кэш descriptions
      queryClient.setQueryData(
        descriptionKeys.byChapter(userId, bookId, chapterNumber),
        response
      );

      // Обновляем chapterCache
      await chapterCache
        .set(bookId, chapterNumber, response.nlp_analysis.descriptions, [])
        .catch((err) => {
          console.warn('⚠️ [useReextractDescriptions] Failed to update cache:', err);
        });

      return response;
    },
    staleTime: 0, // Всегда fresh, так как это ручная операция
    enabled: false, // Запускается только через refetch()
    ...options,
  });
}
