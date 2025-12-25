/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useChapterManagement - Custom hook for managing chapter tracking and loading
 *
 * Handles chapter number extraction from EPUB location and chapter data loading.
 *
 * FIXED (2025-12-25):
 * - Added AbortController to cancel pending requests on chapter change
 * - Added isRestoringPosition prop to prevent race condition during position restoration
 * - Now uses chapter mapping to correctly match spine hrefs to backend chapter numbers
 *
 * @param book - epub.js Book instance
 * @param rendition - epub.js Rendition instance
 * @param bookId - Book ID for API requests
 * @param getChapterNumberByLocation - Function to map location to chapter number
 * @param isRestoringPosition - Flag to prevent loading during position restoration
 * @returns Current chapter number and chapter change handler
 *
 * @example
 * const { getChapterNumberByLocation } = useChapterMapping(toc, chapters);
 * const { currentChapter, descriptions, images } = useChapterManagement({
 *   book,
 *   rendition,
 *   bookId,
 *   getChapterNumberByLocation,
 *   isRestoringPosition,
 * });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  isRestoringPosition?: boolean; // Flag to prevent loading during position restoration
}

interface UseChapterManagementReturn {
  currentChapter: number;
  descriptions: Description[];
  images: GeneratedImage[];
  isLoadingChapter: boolean;
  isExtractingDescriptions: boolean; // LLM extraction in progress
  cancelExtraction: () => void; // Function to cancel ongoing extraction
}

export const useChapterManagement = ({
  book,
  rendition,
  bookId,
  getChapterNumberByLocation,
  isRestoringPosition = false,
}: UseChapterManagementOptions): UseChapterManagementReturn => {
  const userId = getCurrentUserId();
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [descriptions, setDescriptions] = useState<Description[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [isExtractingDescriptions, setIsExtractingDescriptions] = useState(false);

  // AbortController for canceling pending API requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Track pending chapter to load after restoration completes
  const pendingChapterRef = useRef<number | null>(null);
  // Ref to hold prefetch function to avoid circular dependencies
  const prefetchRef = useRef<((chapter: number) => Promise<void>) | null>(null);

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
   * FIXED (2025-12-25): Added AbortController to cancel pending requests
   */
  const loadChapterData = useCallback(async (chapter: number) => {
    if (!bookId || chapter <= 0) return;

    // Cancel any previous pending request
    if (abortControllerRef.current) {
      console.log('🚫 [useChapterManagement] Aborting previous request');
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setIsLoadingChapter(true);
      console.log('📚 [useChapterManagement] Loading data for chapter:', chapter);

      // Check for abort early
      if (signal.aborted) return;

      // Проверяем кэш
      const cachedData = await chapterCache.get(userId, bookId, chapter);

      // Check for abort after async operation
      if (signal.aborted) {
        console.log('🚫 [useChapterManagement] Request aborted after cache check');
        return;
      }

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

      // Check for abort after API call
      if (signal.aborted) {
        console.log('🚫 [useChapterManagement] Request aborted after first API call');
        return;
      }

      let loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];

      // Если описаний нет - запускаем LLM extraction (on-demand)
      if (loadedDescriptions.length === 0) {
        console.log('🔄 [useChapterManagement] No descriptions found, triggering LLM extraction...');
        setIsExtractingDescriptions(true);

        // Retry loop for 409 Conflict (extraction in progress)
        const maxRetries = 4;
        let retryCount = 0;

        while (retryCount < maxRetries) {
          try {
            descriptionsResponse = await booksAPI.getChapterDescriptions(
              bookId,
              chapter,
              true // extract_new = true - запускаем LLM extraction
            );

            // Check for abort after LLM extraction
            if (signal.aborted) {
              console.log('🚫 [useChapterManagement] Request aborted after LLM extraction');
              setIsExtractingDescriptions(false);
              return;
            }

            loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];
            console.log(`✅ [useChapterManagement] LLM extracted ${loadedDescriptions.length} descriptions`);
            break; // Success - exit retry loop

          } catch (extractError: any) {
            // Don't log abort errors as warnings
            if (extractError?.name === 'AbortError') {
              console.log('🚫 [useChapterManagement] LLM extraction aborted');
              return;
            }

            // Handle 409 Conflict - extraction in progress
            if (extractError?.response?.status === 409 || extractError?.status === 409) {
              retryCount++;
              const retryAfter = extractError?.response?.data?.retry_after_seconds || 15;
              console.log(
                `⏳ [useChapterManagement] Extraction in progress, retry ${retryCount}/${maxRetries} in ${retryAfter}s`
              );

              if (retryCount < maxRetries) {
                // Wait and retry
                await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

                // Check if aborted during wait
                if (signal.aborted) {
                  console.log('🚫 [useChapterManagement] Request aborted during retry wait');
                  setIsExtractingDescriptions(false);
                  return;
                }

                // After waiting, try to get existing descriptions (without extract_new)
                console.log('🔄 [useChapterManagement] Checking if extraction completed...');
                descriptionsResponse = await booksAPI.getChapterDescriptions(
                  bookId,
                  chapter,
                  false // Check existing first
                );

                loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];
                if (loadedDescriptions.length > 0) {
                  console.log(`✅ [useChapterManagement] Got ${loadedDescriptions.length} descriptions after wait`);
                  break; // Success - extraction completed while we waited
                }
                // Still empty - continue retry loop
                continue;
              }
            }

            console.warn('⚠️ [useChapterManagement] LLM extraction failed:', extractError);
            // Продолжаем с пустыми описаниями
            break;
          }
        }

        if (!signal.aborted) {
          setIsExtractingDescriptions(false);
        }
      }

      // Final abort check before updating state
      if (signal.aborted) {
        console.log('🚫 [useChapterManagement] Request aborted before state update');
        return;
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

      // Check for abort after images API call
      if (signal.aborted) {
        console.log('🚫 [useChapterManagement] Request aborted after images fetch');
        return;
      }

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

      // Prefetch следующих 2 глав в фоне (для плавного UX)
      // UPDATED (2025-12-25): Расширено до 2 глав для более плавной навигации
      // Use ref to avoid circular dependency issues
      if (prefetchRef.current) {
        prefetchRef.current(chapter);
      }
    } catch (error: any) {
      // Don't log abort errors
      if (error?.name === 'AbortError') {
        console.log('🚫 [useChapterManagement] Request aborted');
        return;
      }
      console.error('❌ [useChapterManagement] Error loading chapter data:', error);
      setDescriptions([]);
      setImages([]);
      setIsLoadingChapter(false);
    }
  }, [userId, bookId]);

  /**
   * Prefetch одной главы в фоне
   * Загружает описания и изображения заранее для плавного перехода
   *
   * @param chapterNumber - Номер главы для prefetch
   * @param allowLLMExtraction - Разрешить LLM extraction (для ближайшей главы)
   * @returns Promise<boolean> - true если prefetch успешен
   */
  const prefetchSingleChapter = useCallback(async (
    chapterNumber: number,
    allowLLMExtraction: boolean = true
  ): Promise<boolean> => {
    if (!bookId || chapterNumber <= 0) return false;

    try {
      // Проверяем, есть ли уже в кэше
      const cachedData = await chapterCache.get(userId, bookId, chapterNumber);
      if (cachedData && cachedData.descriptions.length > 0) {
        console.log(`📦 [useChapterManagement] Chapter ${chapterNumber} already cached`);
        return true;
      }

      console.log(`🔮 [useChapterManagement] Prefetching chapter ${chapterNumber}...`);

      // Загружаем описания (сначала существующие)
      let descriptionsResponse = await booksAPI.getChapterDescriptions(
        bookId,
        chapterNumber,
        false
      );

      let loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];

      // Если пусто и LLM extraction разрешён - извлекаем
      if (loadedDescriptions.length === 0 && allowLLMExtraction) {
        console.log(`🔮 [useChapterManagement] Prefetch: extracting via LLM for chapter ${chapterNumber}...`);
        try {
          descriptionsResponse = await booksAPI.getChapterDescriptions(
            bookId,
            chapterNumber,
            true
          );
          loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];
        } catch (extractError: any) {
          // Ignore 409 Conflict for prefetch - don't wait
          if (extractError?.response?.status === 409 || extractError?.status === 409) {
            console.log(`⏳ [useChapterManagement] Prefetch: chapter ${chapterNumber} extraction in progress elsewhere`);
          } else {
            console.warn(`⚠️ [useChapterManagement] Prefetch LLM extraction failed for chapter ${chapterNumber}:`, extractError);
          }
        }
      } else if (loadedDescriptions.length === 0) {
        console.log(`⏭️ [useChapterManagement] Prefetch: skipping LLM for chapter ${chapterNumber} (allowLLMExtraction=false)`);
      }

      // Загружаем изображения
      const imagesResponse = await imagesAPI.getBookImages(bookId, chapterNumber);

      // Сохраняем в кэш (даже если описаний нет - чтобы избежать повторных запросов)
      if (loadedDescriptions.length > 0) {
        await chapterCache.set(userId, bookId, chapterNumber, loadedDescriptions, imagesResponse.images);
      }

      console.log(`✅ [useChapterManagement] Prefetched chapter ${chapterNumber}: ${loadedDescriptions.length} descriptions, ${imagesResponse.images.length} images`);
      return true;
    } catch (error) {
      // Тихо игнорируем ошибки prefetch - это не критично
      console.warn(`⚠️ [useChapterManagement] Prefetch failed for chapter ${chapterNumber}:`, error);
      return false;
    }
  }, [userId, bookId]);

  /**
   * Prefetch нескольких глав используя Batch API
   *
   * UPDATED (2025-12-25): Phase 3 + P2.3 - batch API + backward prefetch
   * - Batch API загружает описания для N глав одним запросом
   * - Images загружаются отдельно (параллельно)
   * - P2.3: Добавлен prefetch предыдущей главы для плавной навигации назад
   * - Fallback на individual calls если batch fails
   */
  const prefetchNextChapters = useCallback(async (currentChapter: number) => {
    const CHAPTERS_TO_PREFETCH_FORWARD = 2;
    const CHAPTERS_TO_PREFETCH_BACKWARD = 1; // P2.3: Backward prefetch

    // Определяем главы для prefetch (forward + backward)
    const chaptersToFetch: number[] = [];

    // P2.3: Добавляем предыдущую главу (для навигации назад)
    for (let i = 1; i <= CHAPTERS_TO_PREFETCH_BACKWARD; i++) {
      const prevChapter = currentChapter - i;
      if (prevChapter > 0) {
        const cached = await chapterCache.get(userId, bookId, prevChapter);
        if (!cached || cached.descriptions.length === 0) {
          chaptersToFetch.push(prevChapter);
        } else {
          console.log(`📦 [useChapterManagement] Chapter ${prevChapter} already cached, skipping`);
        }
      }
    }

    // Добавляем следующие главы
    for (let i = 1; i <= CHAPTERS_TO_PREFETCH_FORWARD; i++) {
      const nextChapter = currentChapter + i;
      if (nextChapter > 0) {
        // Проверяем кэш перед добавлением
        const cached = await chapterCache.get(userId, bookId, nextChapter);
        if (!cached || cached.descriptions.length === 0) {
          chaptersToFetch.push(nextChapter);
        } else {
          console.log(`📦 [useChapterManagement] Chapter ${nextChapter} already cached, skipping`);
        }
      }
    }

    if (chaptersToFetch.length === 0) {
      console.log('📦 [useChapterManagement] All chapters already cached');
      return;
    }

    // Sort for consistent batch ordering (prev chapters first, then next)
    chaptersToFetch.sort((a, b) => a - b);

    console.log(`🔮 [useChapterManagement] Batch prefetch chapters (backward+forward): ${chaptersToFetch.join(', ')}`);

    try {
      // 1. Batch fetch descriptions (1 HTTP request instead of N)
      const batchResponse = await booksAPI.getBatchDescriptions(bookId, chaptersToFetch);

      console.log(
        `✅ [useChapterManagement] Batch response: ${batchResponse.total_success}/${batchResponse.total_requested} chapters, ` +
        `${batchResponse.total_descriptions} descriptions`
      );

      // 2. Process each chapter and fetch images
      for (const result of batchResponse.chapters) {
        if (!result.success || !result.data) {
          console.warn(`⚠️ [useChapterManagement] Batch: chapter ${result.chapter_number} failed: ${result.error}`);
          continue;
        }

        const descriptions = result.data.nlp_analysis.descriptions || [];

        // Fetch images for this chapter (separate call)
        try {
          const imagesResponse = await imagesAPI.getBookImages(bookId, result.chapter_number);

          // Save to cache
          if (descriptions.length > 0) {
            await chapterCache.set(
              userId,
              bookId,
              result.chapter_number,
              descriptions,
              imagesResponse.images
            );
            console.log(
              `✅ [useChapterManagement] Cached chapter ${result.chapter_number}: ` +
              `${descriptions.length} descriptions, ${imagesResponse.images.length} images`
            );
          }
        } catch (imgError) {
          // Cache descriptions even if images fail
          if (descriptions.length > 0) {
            await chapterCache.set(userId, bookId, result.chapter_number, descriptions, []);
            console.log(
              `⚠️ [useChapterManagement] Cached chapter ${result.chapter_number} without images: ${descriptions.length} descriptions`
            );
          }
        }
      }

      // 3. Log chapters without descriptions (don't trigger LLM in prefetch)
      // FIX: Don't trigger LLM extraction in prefetch - it confuses users when
      // "AI analyzing" shows while they're still reading another chapter.
      // LLM extraction will happen automatically when user opens the chapter.
      const emptyChapters = batchResponse.chapters.filter(
        r => r.success && r.data && r.data.nlp_analysis.descriptions.length === 0
      );

      if (emptyChapters.length > 0) {
        console.log(
          `⏭️ [useChapterManagement] Chapters without descriptions: ${emptyChapters.map(c => c.chapter_number).join(', ')}. ` +
          `Will extract when opened.`
        );
        // NOTE: LLM extraction disabled in prefetch to avoid confusion.
        // Extraction happens on-demand when user navigates to the chapter.
      }

    } catch (error) {
      console.warn('⚠️ [useChapterManagement] Batch prefetch failed, falling back to individual calls:', error);

      // Fallback: individual prefetch
      for (const chapterNum of chaptersToFetch) {
        const allowLLM = chapterNum === chaptersToFetch[0]; // Only first chapter
        await prefetchSingleChapter(chapterNum, allowLLM);
      }
    }
  }, [userId, bookId, prefetchSingleChapter]);

  // Keep ref updated with latest prefetch function
  useEffect(() => {
    prefetchRef.current = prefetchNextChapters;
  }, [prefetchNextChapters]);

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
   * FIXED (2025-12-25): Skip loading during position restoration to prevent race condition
   */
  useEffect(() => {
    if (currentChapter > 0) {
      if (isRestoringPosition) {
        // Store pending chapter to load after restoration completes
        console.log('⏳ [useChapterManagement] Position restoration in progress, deferring chapter load:', currentChapter);
        pendingChapterRef.current = currentChapter;
      } else {
        loadChapterData(currentChapter);
      }
    }
  }, [currentChapter, loadChapterData, isRestoringPosition]);

  /**
   * Load pending chapter after position restoration completes
   */
  useEffect(() => {
    if (!isRestoringPosition && pendingChapterRef.current !== null) {
      console.log('✅ [useChapterManagement] Position restoration complete, loading pending chapter:', pendingChapterRef.current);
      loadChapterData(pendingChapterRef.current);
      pendingChapterRef.current = null;
    }
  }, [isRestoringPosition, loadChapterData]);

  /**
   * Cleanup: abort pending requests on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log('🧹 [useChapterManagement] Cleanup: aborting pending request');
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

  /**
   * Cancel ongoing extraction (user-triggered)
   */
  const cancelExtraction = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('🚫 [useChapterManagement] User cancelled extraction');
      abortControllerRef.current.abort();
      setIsExtractingDescriptions(false);
      setIsLoadingChapter(false);
    }
  }, []);

  return {
    currentChapter,
    descriptions,
    images,
    isLoadingChapter,
    isExtractingDescriptions,
    cancelExtraction,
  };
};
