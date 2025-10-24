/**
 * useChapterManagement - Custom hook for managing chapter tracking and loading
 *
 * Handles chapter number extraction from EPUB location and chapter data loading.
 *
 * @param book - epub.js Book instance
 * @param rendition - epub.js Rendition instance
 * @param onChapterChange - Callback when chapter changes
 * @returns Current chapter number and chapter change handler
 *
 * @example
 * const { currentChapter, descriptions, images } = useChapterManagement(
 *   book,
 *   rendition,
 *   bookId
 * );
 */

import { useState, useEffect, useCallback } from 'react';
import type { Book, Rendition } from 'epubjs';
import { booksAPI } from '@/api/books';
import { imagesAPI } from '@/api/images';
import type { Description, GeneratedImage } from '@/types/api';

interface UseChapterManagementOptions {
  book: Book | null;
  rendition: Rendition | null;
  bookId: string;
}

interface UseChapterManagementReturn {
  currentChapter: number;
  descriptions: Description[];
  images: GeneratedImage[];
  isLoadingChapter: boolean;
}

export const useChapterManagement = ({
  book,
  rendition,
  bookId,
}: UseChapterManagementOptions): UseChapterManagementReturn => {
  const [currentChapter, setCurrentChapter] = useState<number>(1);
  const [descriptions, setDescriptions] = useState<Description[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);

  /**
   * Extract chapter number from EPUB location
   */
  const getChapterFromLocation = useCallback((location: any): number => {
    try {
      if (!book) return 1;

      const currentHref = location?.start?.href;
      if (!currentHref) {
        console.warn('⚠️ [useChapterManagement] No href in location');
        return 1;
      }

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
      console.log(`📖 [useChapterManagement] Chapter detected: ${chapter} (spine index: ${spineIndex})`);
      return Math.max(1, chapter);

    } catch (error) {
      console.error('❌ [useChapterManagement] Error extracting chapter:', error);
      return 1;
    }
  }, [book]);

  /**
   * Load descriptions and images for current chapter
   */
  const loadChapterData = useCallback(async (chapter: number) => {
    if (!bookId || chapter <= 0) return;

    try {
      setIsLoadingChapter(true);
      console.log('📚 [useChapterManagement] Loading data for chapter:', chapter);

      // Load descriptions
      const descriptionsResponse = await booksAPI.getChapterDescriptions(
        bookId,
        chapter,
        false // Use cache
      );

      const loadedDescriptions = descriptionsResponse.nlp_analysis.descriptions || [];
      console.log('✅ [useChapterManagement] Descriptions loaded:', loadedDescriptions.length);
      setDescriptions(loadedDescriptions);

      // Load images
      const imagesResponse = await imagesAPI.getBookImages(bookId, chapter);
      console.log('✅ [useChapterManagement] Images loaded:', imagesResponse.images.length);
      setImages(imagesResponse.images);

      setIsLoadingChapter(false);
    } catch (error) {
      console.error('❌ [useChapterManagement] Error loading chapter data:', error);
      setDescriptions([]);
      setImages([]);
      setIsLoadingChapter(false);
    }
  }, [bookId]);

  /**
   * Listen to relocated events to detect chapter changes
   */
  useEffect(() => {
    if (!rendition || !book) return;

    const handleRelocated = (location: any) => {
      const chapter = getChapterFromLocation(location);
      setCurrentChapter(chapter);
    };

    rendition.on('relocated', handleRelocated);

    // Get initial chapter
    const currentLocation = rendition.currentLocation();
    if (currentLocation) {
      const initialChapter = getChapterFromLocation(currentLocation);
      setCurrentChapter(initialChapter);
    }

    return () => {
      rendition.off('relocated', handleRelocated);
    };
  }, [rendition, book, getChapterFromLocation]);

  /**
   * Load chapter data when chapter changes
   */
  useEffect(() => {
    if (currentChapter > 0) {
      loadChapterData(currentChapter);
    }
  }, [currentChapter, loadChapterData]);

  return {
    currentChapter,
    descriptions,
    images,
    isLoadingChapter,
  };
};
