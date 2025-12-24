/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useChapterManagement - Custom hook for managing chapter tracking and loading
 *
 * Handles chapter number extraction from EPUB location and chapter data loading.
 *
 * FIXED: Now uses chapter mapping to correctly match spine hrefs to backend chapter numbers.
 * Previously used spineIndex + 1 which caused mismatch with backend's logical chapter numbers.
 *
 * @param book - epub.js Book instance
 * @param rendition - epub.js Rendition instance
 * @param bookId - Book ID for API requests
 * @param getChapterNumberByLocation - Function to map location to chapter number
 * @returns Current chapter number and chapter change handler
 *
 * @example
 * const { getChapterNumberByLocation } = useChapterMapping(toc, chapters);
 * const { currentChapter, descriptions, images } = useChapterManagement({
 *   book,
 *   rendition,
 *   bookId,
 *   getChapterNumberByLocation
 * });
 */

import { useState, useEffect, useCallback } from 'react';
import type { Book, Rendition, Location } from '@/types/epub';
import { booksAPI } from '@/api/books';
import { imagesAPI } from '@/api/images';
import type { Description, GeneratedImage } from '@/types/api';
import { chapterCache } from '@/services/chapterCache';
import { getCurrentUserId } from '@/hooks/api/queryKeys';

interface UseChapterManagementOptions {
  book: Book | null;
  rendition: Rendition | null;
  bookId: string;
  getChapterNumberByLocation?: ((location: Location) => number | null) | null;
}

interface UseChapterManagementReturn {
  currentChapter: number;
  descriptions: Description[];
  images: GeneratedImage[];
  isLoadingChapter: boolean;
  isExtractingDescriptions: boolean; // LLM extraction in progress
}

export const useChapterManagement = ({
  book,
  rendition,
  bookId,
  getChapterNumberByLocation,
}: UseChapterManagementOptions): UseChapterManagementReturn => {
  const userId = getCurrentUserId();
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [descriptions, setDescriptions] = useState<Description[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [isExtractingDescriptions, setIsExtractingDescriptions] = useState(false);

  /**
   * Extract chapter number from EPUB location
   * FIXED: Now uses chapter mapping instead of spineIndex + 1
   */
  const getChapterFromLocation_Internal = useCallback((location: Location): number => {
    try {
      if (!book) return 1;

      const currentHref = location?.start?.href;
      if (!currentHref) {
        console.warn('⚠️ [useChapterManagement] No href in location');
        return 1;
      }

      // FIXED: Use chapter mapping if available
      if (getChapterNumberByLocation) {
        const mappedChapter = getChapterNumberByLocation(location);
        if (mappedChapter !== null) {
          console.log(`📖 [useChapterManagement] Chapter detected via mapping: ${mappedChapter} (href: ${currentHref})`);
          return mappedChapter;
        } else {
          console.warn(`⚠️ [useChapterManagement] No mapping found for href: ${currentHref}, falling back to spine index`);
        }
      }

      // Fallback: use spine index + 1 (old behavior, less reliable)
      const spine = (book as any).spine;
      if (!spine || !spine.items) {
        console.warn('⚠️ [useChapterManagement] No spine items');
        return 1;
      }

      const spineIndex = spine.items.findIndex((item: any) => {
        return item.href === currentHref || item.href.includes(currentHref);
      });

      if (spineIndex === -1) {
        console.warn('⚠️ [useChapterManagement] Spine item not found for href:', currentHref);
        return 1;
      }

      const chapter = spineIndex + 1;
      console.log(`📖 [useChapterManagement] Chapter detected (fallback): ${chapter} (spine index: ${spineIndex})`);
      return Math.max(1, chapter);

    } catch (error) {
      console.error('❌ [useChapterManagement] Error extracting chapter:', error);
      return 1;
    }
  }, [book, getChapterNumberByLocation]);

  /**
   * Load descriptions and images for current chapter
   * ОПТИМИЗАЦИЯ: Использует IndexedDB кэш для избежания повторных API запросов
   */
  const loadChapterData = useCallback(async (chapter: number) => {
    if (!bookId || chapter <= 0) return;

    try {
      setIsLoadingChapter(true);
      console.log('📚 [useChapterManagement] Loading data for chapter:', chapter);

      // Проверяем кэш
      const cachedData = await chapterCache.get(userId, bookId, chapter);

      // Проверяем кэш ТОЛЬКО если там есть описания
      if (cachedData && cachedData.descriptions.length > 0) {
        // Используем кэшированные данные
        console.log('✅ [useChapterManagement] Using cached chapter data:', {
          chapter,
          descriptionsCount: cachedData.descriptions.length,
          imagesCount: cachedData.images.length,
        });

        setDescriptions(cachedData.descriptions);
        setImages(cachedData.images);
        setIsLoadingChapter(false);
        return;
      }

      // Кэша нет или он пустой - загружаем с API
      console.log('📡 [useChapterManagement] Cache miss or empty, fetching from API...');

      // Load descriptions - сначала проверяем существующие (extract_new=false)
      let descriptionsResponse = await booksAPI.getChapterDescriptions(
        bookId,
        chapter,
        false // Сначала проверяем существующие
      );

      let loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];

      // Если описаний нет - запускаем LLM extraction (on-demand)
      if (loadedDescriptions.length === 0) {
        console.log('🔄 [useChapterManagement] No descriptions found, triggering LLM extraction...');
        setIsExtractingDescriptions(true);
        try {
          descriptionsResponse = await booksAPI.getChapterDescriptions(
            bookId,
            chapter,
            true // extract_new = true - запускаем LLM extraction
          );
          loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];
          console.log(`✅ [useChapterManagement] LLM extracted ${loadedDescriptions.length} descriptions`);
        } catch (extractError) {
          console.warn('⚠️ [useChapterManagement] LLM extraction failed:', extractError);
          // Продолжаем с пустыми описаниями
        } finally {
          setIsExtractingDescriptions(false);
        }
      }
      console.log('✅ [useChapterManagement] Descriptions loaded:', {
        count: loadedDescriptions.length,
        sampleDescription: loadedDescriptions[0] ? {
          id: loadedDescriptions[0].id,
          type: loadedDescriptions[0].type,
          textLength: loadedDescriptions[0].text?.length || 0,
          contentLength: loadedDescriptions[0].content?.length || 0,
        } : null,
      });

      // Load images
      const imagesResponse = await imagesAPI.getBookImages(bookId, chapter);
      console.log('✅ [useChapterManagement] Images loaded:', {
        count: imagesResponse.images.length,
        sampleImage: imagesResponse.images[0] ? {
          id: imagesResponse.images[0].id,
          description_id: imagesResponse.images[0].description_id,
          hasUrl: !!imagesResponse.images[0].image_url,
        } : null,
      });

      const loadedImages = imagesResponse.images;

      // Сохраняем в кэш
      await chapterCache.set(userId, bookId, chapter, loadedDescriptions, loadedImages);

      setDescriptions(loadedDescriptions);
      setImages(loadedImages);
      setIsLoadingChapter(false);

      // Prefetch следующей главы в фоне (для плавного UX)
      prefetchNextChapter(chapter + 1);
    } catch (error) {
      console.error('❌ [useChapterManagement] Error loading chapter data:', error);
      setDescriptions([]);
      setImages([]);
      setIsLoadingChapter(false);
    }
  }, [userId, bookId]);

  /**
   * Prefetch следующей главы в фоне
   * Загружает описания и изображения заранее для плавного перехода
   */
  const prefetchNextChapter = useCallback(async (nextChapter: number) => {
    if (!bookId || nextChapter <= 0) return;

    try {
      // Проверяем, есть ли уже в кэше
      const cachedData = await chapterCache.get(userId, bookId, nextChapter);
      if (cachedData && cachedData.descriptions.length > 0) {
        console.log(`📦 [useChapterManagement] Next chapter ${nextChapter} already cached`);
        return;
      }

      console.log(`🔮 [useChapterManagement] Prefetching next chapter ${nextChapter}...`);

      // Загружаем описания (сначала существующие)
      let descriptionsResponse = await booksAPI.getChapterDescriptions(
        bookId,
        nextChapter,
        false
      );

      let loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];

      // Если пусто - извлекаем через LLM
      if (loadedDescriptions.length === 0) {
        console.log(`🔮 [useChapterManagement] Prefetch: extracting via LLM for chapter ${nextChapter}...`);
        try {
          descriptionsResponse = await booksAPI.getChapterDescriptions(
            bookId,
            nextChapter,
            true
          );
          loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];
        } catch (extractError) {
          console.warn(`⚠️ [useChapterManagement] Prefetch LLM extraction failed for chapter ${nextChapter}:`, extractError);
        }
      }

      // Загружаем изображения
      const imagesResponse = await imagesAPI.getBookImages(bookId, nextChapter);

      // Сохраняем в кэш
      await chapterCache.set(userId, bookId, nextChapter, loadedDescriptions, imagesResponse.images);

      console.log(`✅ [useChapterManagement] Prefetched chapter ${nextChapter}: ${loadedDescriptions.length} descriptions, ${imagesResponse.images.length} images`);
    } catch (error) {
      // Тихо игнорируем ошибки prefetch - это не критично
      console.warn(`⚠️ [useChapterManagement] Prefetch failed for chapter ${nextChapter}:`, error);
    }
  }, [userId, bookId]);

  /**
   * Listen to relocated events to detect chapter changes
   */
  useEffect(() => {
    if (!rendition || !book) return;

    const handleRelocated = (location: Location) => {
      const chapter = getChapterFromLocation_Internal(location);
      setCurrentChapter(chapter);
    };

    rendition.on('relocated', handleRelocated as (...args: unknown[]) => void);

    // Get initial chapter - safely check if currentLocation exists
    // Wait a bit for rendition to be fully initialized
    const timer = setTimeout(() => {
      try {
        // Check if currentLocation method exists and rendition.location is ready
        if (rendition.currentLocation && typeof rendition.currentLocation === 'function') {
          const currentLocation = rendition.currentLocation();
          if (currentLocation) {
            const initialChapter = getChapterFromLocation_Internal(currentLocation);
            setCurrentChapter(initialChapter);
            console.log('📖 [useChapterManagement] Initial chapter set:', initialChapter);
          }
        }
      } catch (error) {
        console.warn('⚠️ [useChapterManagement] Could not get initial location:', error);
        // Fallback to chapter 1
        setCurrentChapter(1);
      }
    }, 100); // Small delay to ensure rendition is ready

    return () => {
      clearTimeout(timer);
      rendition.off('relocated', handleRelocated as (...args: unknown[]) => void);
    };
  }, [rendition, book, getChapterFromLocation_Internal]);

  /**
   * Load chapter data when chapter changes
   */
  useEffect(() => {
    if (currentChapter > 0) {
      loadChapterData(currentChapter);
    }
  }, [currentChapter, loadChapterData]);

  /**
   * Периодическая очистка устаревших записей кэша
   * Запускается при монтировании компонента (1 раз при открытии книги)
   */
  useEffect(() => {
    // Запускаем maintenance асинхронно, не блокируя UI
    chapterCache.performMaintenance().catch((err) => {
      console.warn('⚠️ [useChapterManagement] Cache maintenance failed:', err);
    });
  }, []); // Только при монтировании

  return {
    currentChapter,
    descriptions,
    images,
    isLoadingChapter,
    isExtractingDescriptions,
  };
};
