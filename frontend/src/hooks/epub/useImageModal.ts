/**
 * useImageModal - Custom hook for managing image modal state
 *
 * Handles the modal state for displaying description images.
 * Includes image generation with status tracking and 409 error handling.
 * Now with IndexedDB caching for offline access.
 *
 * @returns Modal state and control functions
 *
 * @example
 * const { selectedImage, isGenerating, openModal, closeModal } = useImageModal({ bookId });
 * openModal(description, image);
 */

import { useState, useCallback, useRef } from 'react';
import type { Description, GeneratedImage } from '@/types/api';
import { imagesAPI } from '@/api/images';
import { notify } from '@/stores/ui';
import { imageCache } from '@/services/imageCache';
import { getCurrentUserId } from '@/hooks/api/queryKeys';

export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error';

interface UseImageModalOptions {
  bookId?: string; // Required for caching
  enableCache?: boolean; // Default: true
}

interface UseImageModalReturn {
  selectedImage: GeneratedImage | null;
  selectedDescription: Description | null;
  isOpen: boolean;
  isGenerating: boolean;
  generationStatus: GenerationStatus;
  generationError: string | null;
  descriptionPreview: string | null;
  isCached: boolean; // NEW: indicates if current image is from cache
  openModal: (description: Description, image?: GeneratedImage) => Promise<void>;
  closeModal: () => void;
  updateImage: (newImageUrl: string) => void;
  cancelGeneration: () => void;
}

export const useImageModal = (options: UseImageModalOptions = {}): UseImageModalReturn => {
  const { bookId, enableCache = true } = options;
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [selectedDescription, setSelectedDescription] = useState<Description | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [descriptionPreview, setDescriptionPreview] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  // AbortController for cancelling generation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Try to get cached image URL
   * Returns null if not cached or cache disabled
   */
  const getCachedImageUrl = useCallback(
    async (descriptionId: string): Promise<string | null> => {
      if (!enableCache || !bookId) return null;
      try {
        const userId = getCurrentUserId();
        return await imageCache.get(userId, descriptionId);
      } catch {
        return null;
      }
    },
    [enableCache, bookId]
  );

  /**
   * Cache image for offline use
   */
  const cacheImage = useCallback(
    async (descriptionId: string, imageUrl: string): Promise<void> => {
      if (!enableCache || !bookId) return;
      try {
        const userId = getCurrentUserId();
        await imageCache.set(userId, descriptionId, imageUrl, bookId);
      } catch (err) {
        console.warn('⚠️ [useImageModal] Failed to cache image:', err);
      }
    },
    [enableCache, bookId]
  );

  /**
   * Open modal with description and optional image
   * If no image exists, check cache first, then generate
   * Handles 409 (image exists) by fetching the existing image
   */
  const openModal = useCallback(async (description: Description, image?: GeneratedImage) => {
    console.log('🖼️ [useImageModal] Opening modal for description:', description.id);

    // Clear previous errors
    setGenerationError(null);
    setSelectedDescription(description);
    setDescriptionPreview(description.content?.substring(0, 100) || null);
    setIsCached(false);

    // If image already provided, check cache for local URL
    if (image) {
      console.log('✅ [useImageModal] Image exists:', image.image_url);

      // Try to use cached version for faster/offline display
      const cachedUrl = await getCachedImageUrl(description.id);
      if (cachedUrl) {
        console.log('📦 [useImageModal] Using cached image');
        setSelectedImage({ ...image, image_url: cachedUrl });
        setIsCached(true);
      } else {
        setSelectedImage(image);
        // Cache the image for future offline use (async, don't wait)
        cacheImage(description.id, image.image_url);
      }

      setIsOpen(true);
      setGenerationStatus('completed');
      return;
    }

    // Check cache first before generating
    const cachedUrl = await getCachedImageUrl(description.id);
    if (cachedUrl) {
      console.log('📦 [useImageModal] Found in cache, skipping generation');

      const cachedImage: GeneratedImage = {
        id: description.id,
        image_url: cachedUrl,
        service_used: 'cached',
        status: 'completed',
        generation_time_seconds: 0,
        created_at: new Date().toISOString(),
        is_moderated: false,
        view_count: 0,
        download_count: 0,
        description: {
          id: description.id,
          type: description.type,
          text: description.content,
          content: description.content,
          confidence_score: description.confidence_score || 0,
          priority_score: description.priority_score,
        },
        chapter: {
          id: '',
          number: 0,
          title: '',
        },
      };

      setSelectedImage(cachedImage);
      setIsOpen(true);
      setGenerationStatus('completed');
      setIsCached(true);
      return;
    }

    // Generate image if not in cache
    console.log('🎨 [useImageModal] No image found, generating...');
    setIsGenerating(true);
    setGenerationStatus('generating');

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      // Generate image using description ID
      const result = await imagesAPI.generateImageForDescription(description.id);

      console.log('✅ [useImageModal] Image generated:', result);
      console.log('✅ [useImageModal] Image URL:', result.image_url);
      console.log('✅ [useImageModal] Image URL type:', typeof result.image_url);

      const newImage: GeneratedImage = {
        id: result.image_id,
        image_url: result.image_url,
        service_used: 'pollinations',
        status: 'completed',
        generation_time_seconds: result.generation_time,
        created_at: result.created_at,
        is_moderated: false,
        view_count: 0,
        download_count: 0,
        description: {
          id: description.id,
          type: description.type,
          text: description.content,  // Full text
          content: description.content,
          confidence_score: description.confidence_score || 0,
          priority_score: description.priority_score,
        },
        chapter: {
          id: '',
          number: 0,
          title: '',
        },
      };

      setSelectedImage(newImage);
      setIsOpen(true);
      setGenerationStatus('completed');

      // Cache the generated image (async, don't wait)
      cacheImage(description.id, result.image_url);

      notify.success(
        'Изображение создано',
        `Сгенерировано за ${result.generation_time.toFixed(1)}с`
      );
    } catch (error: any) {
      console.error('❌ [useImageModal] Image generation failed:', error);

      // Check for 409 - image already exists
      // The API client transforms the error, so check both response.status and message
      const isConflict =
        error.response?.status === 409 ||
        error.message?.includes('already exists') ||
        error.details?.detail?.includes?.('already exists');

      if (isConflict) {
        console.log('🔄 [useImageModal] Image already exists, fetching...');

        try {
          // Fetch existing image
          const existingImage = await imagesAPI.getImageForDescription(description.id);

          console.log('✅ [useImageModal] Fetched existing image:', existingImage.image_url);

          setSelectedImage(existingImage);
          setIsOpen(true);
          setGenerationStatus('completed');

          // Cache the fetched image (async, don't wait)
          cacheImage(description.id, existingImage.image_url);

          // Don't show warning - just open the modal silently
        } catch (fetchError: any) {
          console.error('❌ [useImageModal] Failed to fetch existing image:', fetchError);
          setGenerationError('Не удалось загрузить существующее изображение');
          setGenerationStatus('error');
          notify.error('Ошибка', 'Не удалось загрузить изображение');
        }
      } else {
        // Handle other errors
        const errorMessage = error.message || error.response?.data?.detail || 'Не удалось создать изображение';
        setGenerationError(errorMessage);
        setGenerationStatus('error');
        notify.error('Ошибка генерации', errorMessage);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, [getCachedImageUrl, cacheImage]);

  /**
   * Close modal and reset state
   * ВАЖНО: Освобождает Object URL если изображение было из кеша
   */
  const closeModal = useCallback(() => {
    console.log('❌ [useImageModal] Closing modal');
    setIsOpen(false);

    // Освобождаем Object URL если изображение из кеша
    if (isCached && selectedDescription) {
      console.log('🧹 [useImageModal] Releasing cached Object URL for:', selectedDescription.id);
      imageCache.release(selectedDescription.id);
    }

    // Don't clear selectedImage immediately - allow animation
    setTimeout(() => {
      setSelectedImage(null);
      setSelectedDescription(null);
      setGenerationError(null);
      setDescriptionPreview(null);
      setIsCached(false);
      // Don't reset status to idle - keep it for status bar to show completion
    }, 300);
  }, [isCached, selectedDescription]);

  /**
   * Cancel ongoing generation
   */
  const cancelGeneration = useCallback(() => {
    console.log('🛑 [useImageModal] Cancelling generation');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setGenerationStatus('idle');
    setGenerationError(null);
    setDescriptionPreview(null);
  }, []);

  /**
   * Update image URL (after regeneration)
   */
  const updateImage = useCallback((newImageUrl: string) => {
    console.log('🔄 [useImageModal] Updating image URL:', newImageUrl);

    if (selectedImage) {
      setSelectedImage({
        ...selectedImage,
        image_url: newImageUrl,
      });
    }
  }, [selectedImage]);

  return {
    selectedImage,
    selectedDescription,
    isOpen,
    isGenerating,
    generationStatus,
    generationError,
    descriptionPreview,
    isCached,
    openModal,
    closeModal,
    updateImage,
    cancelGeneration,
  };
};
