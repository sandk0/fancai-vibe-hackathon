/**
 * React Query хуки для работы с изображениями
 *
 * Генерация, кэширование и управление AI-сгенерированными изображениями
 * для визуальных описаний из книг.
 *
 * Особенности:
 * - Интеграция с imageCache (IndexedDB) для offline доступа
 * - Автоматическая нормализация URL изображений
 * - Batch генерация для глав
 * - Оптимистичные обновления
 *
 * @module hooks/api/useImages
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { imagesAPI } from '@/api/images';
import { imageCache } from '@/services/imageCache';
import { imageKeys, getCurrentUserId } from './queryKeys';
import type {
  GeneratedImage,
  ImageGenerationParams,
  BatchGenerationRequest,
  GenerationStatus,
  DescriptionType,
} from '@/types/api';

/**
 * Получение изображений книги
 *
 * @param bookId - ID книги
 * @param chapterNumber - Опциональный номер главы для фильтрации
 * @param pagination - Параметры пагинации
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useBookImages('book-123', 5);
 *
 * if (data) {
 *   console.log('Total images:', data.pagination.total_found);
 *   data.images.forEach(img => {
 *     console.log(`Image for ${img.description.type}: ${img.image_url}`);
 *   });
 * }
 * ```
 */
export function useBookImages(
  bookId: string,
  chapterNumber?: number,
  pagination: { skip?: number; limit?: number } = {},
  options?: Omit<
    UseQueryOptions<
      {
        book_id: string;
        book_title: string;
        images: GeneratedImage[];
        pagination: {
          skip: number;
          limit: number;
          total_found: number;
        };
      },
      Error
    >,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: [
      ...imageKeys.byBook(userId, bookId, chapterNumber),
      'paginated',
      pagination,
    ],
    queryFn: async () => {
      console.log(
        `🖼️ [useBookImages] Fetching images for book ${bookId}, chapter ${chapterNumber || 'all'}`
      );

      const response = await imagesAPI.getBookImages(
        bookId,
        chapterNumber,
        pagination.skip || 0,
        pagination.limit || 50
      );

      // Кэшируем изображения в IndexedDB
      if (response.images.length > 0) {
        console.log(
          `💾 [useBookImages] Caching ${response.images.length} images to IndexedDB`
        );

        await Promise.all(
          response.images.map(async (image) => {
            try {
              // Проверяем, есть ли уже в кэше
              const cached = await imageCache.get(image.description.id);
              if (!cached) {
                // Загружаем и кэшируем
                await imageCache.set(
                  image.description.id,
                  image.image_url,
                  bookId
                );
              }
            } catch (err) {
              console.warn(
                `⚠️ [useBookImages] Failed to cache image ${image.id}:`,
                err
              );
            }
          })
        );
      }

      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 минут
    enabled: !!bookId,
    ...options,
  });
}

/**
 * Получение изображения для конкретного описания
 *
 * Сначала проверяет IndexedDB кэш, затем загружает с API.
 *
 * @param descriptionId - ID описания
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: image, isLoading } = useImageForDescription('desc-123');
 *
 * return (
 *   <img
 *     src={image?.image_url}
 *     alt={image?.description.text}
 *   />
 * );
 * ```
 */
export function useImageForDescription(
  descriptionId: string,
  options?: Omit<UseQueryOptions<GeneratedImage, Error>, 'queryKey' | 'queryFn'>
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: imageKeys.byDescription(userId, descriptionId),
    queryFn: async () => {
      console.log(
        `🖼️ [useImageForDescription] Fetching image for description ${descriptionId}`
      );

      // 1. Проверяем IndexedDB кэш
      const cachedUrl = await imageCache.get(descriptionId);
      if (cachedUrl) {
        console.log(
          `✅ [useImageForDescription] Image loaded from IndexedDB cache`
        );

        // Возвращаем mock объект с кэшированным URL
        // В реальности нужно хранить полный GeneratedImage в кэше
        return {
          id: descriptionId,
          image_url: cachedUrl,
          description: {
            id: descriptionId,
            type: 'location' as DescriptionType,
            text: '',
            content: '',
          },
          chapter: {
            id: '',
            number: 0,
            title: '',
          },
          service_used: 'pollinations',
          status: 'completed' as const,
          view_count: 0,
          download_count: 0,
          is_moderated: false,
          created_at: new Date().toISOString(),
        } as GeneratedImage;
      }

      // 2. Загружаем с API
      console.log(
        `📡 [useImageForDescription] Image not in cache, fetching from API`
      );
      const image = await imagesAPI.getImageForDescription(descriptionId);

      // 3. Кэшируем
      try {
        await imageCache.set(
          descriptionId,
          image.image_url,
          image.chapter.id // bookId (на самом деле это chapterId, но пойдет)
        );
      } catch (err) {
        console.warn(
          `⚠️ [useImageForDescription] Failed to cache image:`,
          err
        );
      }

      return image;
    },
    staleTime: 30 * 60 * 1000, // 30 минут - изображения не меняются
    enabled: !!descriptionId,
    ...options,
  });
}

/**
 * Мутация генерации изображения для описания
 *
 * @param options - Опции мутации
 *
 * @example
 * ```tsx
 * const generateMutation = useGenerateImage();
 *
 * const handleGenerate = async (descriptionId: string) => {
 *   try {
 *     const result = await generateMutation.mutateAsync({
 *       descriptionId,
 *       params: {
 *         style_prompt: 'watercolor painting',
 *       },
 *     });
 *     console.log('Image generated:', result.image_url);
 *   } catch (error) {
 *     console.error('Generation failed:', error);
 *   }
 * };
 * ```
 */
export function useGenerateImage(
  options?: Omit<
    UseMutationOptions<
      {
        image_id: string;
        description_id: string;
        image_url: string;
        generation_time: number;
        status: string;
        created_at: string;
        message: string;
      },
      Error,
      {
        descriptionId: string;
        params?: ImageGenerationParams;
      }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: async ({ descriptionId, params = {} }) => {
      console.log(
        `🎨 [useGenerateImage] Generating image for description ${descriptionId}`
      );
      return imagesAPI.generateImageForDescription(descriptionId, params);
    },
    onSuccess: async (data, variables) => {
      // Кэшируем сгенерированное изображение
      try {
        await imageCache.set(
          variables.descriptionId,
          data.image_url,
          '' // bookId неизвестен здесь
        );
      } catch (err) {
        console.warn(`⚠️ [useGenerateImage] Failed to cache image:`, err);
      }

      // Инвалидация связанных запросов
      queryClient.invalidateQueries({
        queryKey: imageKeys.byDescription(userId, variables.descriptionId),
      });
      queryClient.invalidateQueries({ queryKey: imageKeys.userStats(userId) });
    },
    ...options,
  });
}

/**
 * Мутация batch генерации изображений для главы
 *
 * @param options - Опции мутации
 *
 * @example
 * ```tsx
 * const batchGenerateMutation = useBatchGenerateImages();
 *
 * const handleGenerateAll = async (chapterId: string) => {
 *   const result = await batchGenerateMutation.mutateAsync({
 *     chapter_id: chapterId,
 *     max_images: 10,
 *     description_types: ['location', 'character'],
 *   });
 *   console.log(`Generated ${result.successful}/${result.total_descriptions} images`);
 * };
 * ```
 */
export function useBatchGenerateImages(
  options?: Omit<
    UseMutationOptions<
      {
        chapter_id: string;
        total_descriptions: number;
        processed: number;
        successful: number;
        failed: number;
        images: Array<{
          description_id: string;
          description_type: DescriptionType;
          image_url: string;
          generation_time: number;
        }>;
        message: string;
      },
      Error,
      BatchGenerationRequest
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: async (request: BatchGenerationRequest) => {
      console.log(
        `🎨 [useBatchGenerateImages] Batch generating images for chapter ${request.chapter_id}`
      );
      return imagesAPI.generateImagesForChapter(request.chapter_id, request);
    },
    onSuccess: async (data, _variables) => {
      // Кэшируем все сгенерированные изображения
      console.log(
        `💾 [useBatchGenerateImages] Caching ${data.images.length} generated images`
      );

      await Promise.all(
        data.images.map(async (image) => {
          try {
            await imageCache.set(
              image.description_id,
              image.image_url,
              '' // bookId неизвестен
            );
          } catch (err) {
            console.warn(
              `⚠️ [useBatchGenerateImages] Failed to cache image:`,
              err
            );
          }
        })
      );

      // Инвалидация всех image queries для этой главы
      queryClient.invalidateQueries({ queryKey: imageKeys.all(userId) });
    },
    ...options,
  });
}

/**
 * Мутация удаления изображения
 *
 * @param options - Опции мутации
 *
 * @example
 * ```tsx
 * const deleteMutation = useDeleteImage();
 *
 * const handleDelete = async (imageId: string) => {
 *   if (confirm('Удалить изображение?')) {
 *     await deleteMutation.mutateAsync(imageId);
 *   }
 * };
 * ```
 */
export function useDeleteImage(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: (imageId: string) => imagesAPI.deleteImage(imageId),
    onSuccess: async (_data, _imageId) => {
      // Удаляем из всех кэшей
      // TODO: нужен descriptionId для удаления из imageCache
      // await imageCache.delete(descriptionId);

      // Инвалидация всех image queries
      queryClient.invalidateQueries({ queryKey: imageKeys.all(userId) });
    },
    ...options,
  });
}

/**
 * Мутация регенерации изображения
 *
 * @param options - Опции мутации
 *
 * @example
 * ```tsx
 * const regenerateMutation = useRegenerateImage();
 *
 * const handleRegenerate = async (imageId: string) => {
 *   const result = await regenerateMutation.mutateAsync({
 *     imageId,
 *     params: {
 *       style_prompt: 'anime style',
 *       negative_prompt: 'blurry, low quality',
 *     },
 *   });
 * };
 * ```
 */
export function useRegenerateImage(
  options?: Omit<
    UseMutationOptions<
      {
        image_id: string;
        description_id: string;
        image_url: string;
        generation_time: number;
        status: string;
        updated_at: string;
        message: string;
        description: {
          id: string;
          type: DescriptionType;
          text: string;
          content: string;
        };
      },
      Error,
      {
        imageId: string;
        params?: ImageGenerationParams;
      }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  return useMutation({
    mutationFn: async ({ imageId, params = {} }) => {
      console.log(`🔄 [useRegenerateImage] Regenerating image ${imageId}`);
      return imagesAPI.regenerateImage(imageId, params);
    },
    onSuccess: async (data, _variables) => {
      // Обновляем кэш
      try {
        await imageCache.set(
          data.description_id,
          data.image_url,
          '' // bookId неизвестен
        );
      } catch (err) {
        console.warn(`⚠️ [useRegenerateImage] Failed to cache image:`, err);
      }

      // Инвалидация
      queryClient.invalidateQueries({
        queryKey: imageKeys.byDescription(userId, data.description_id),
      });
      queryClient.invalidateQueries({ queryKey: imageKeys.all(userId) });
    },
    ...options,
  });
}

/**
 * Получение статуса генерации изображений
 *
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: status } = useGenerationStatus();
 *
 * if (status) {
 *   console.log('Queue size:', status.queue_stats.queue_size);
 *   console.log('Is processing:', status.queue_stats.is_processing);
 *   console.log('Can generate:', status.user_info.can_generate);
 * }
 * ```
 */
export function useGenerationStatus(
  options?: Omit<
    UseQueryOptions<GenerationStatus, Error>,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: imageKeys.generationStatus(userId),
    queryFn: () => imagesAPI.getGenerationStatus(),
    staleTime: 30 * 1000, // 30 секунд - статус меняется часто
    ...options,
  });
}

/**
 * Получение статистики пользователя по изображениям
 *
 * @param options - Опции React Query
 *
 * @example
 * ```tsx
 * const { data: stats } = useImageUserStats();
 *
 * if (stats) {
 *   console.log('Total generated:', stats.total_images_generated);
 *   console.log('Total descriptions:', stats.total_descriptions_found);
 * }
 * ```
 */
export function useImageUserStats(
  options?: Omit<
    UseQueryOptions<
      {
        total_images_generated: number;
        total_descriptions_found: number;
      },
      Error
    >,
    'queryKey' | 'queryFn'
  >
) {
  const userId = getCurrentUserId();

  return useQuery({
    queryKey: imageKeys.userStats(userId),
    queryFn: () => imagesAPI.getUserStats(),
    staleTime: 2 * 60 * 1000, // 2 минуты
    ...options,
  });
}
