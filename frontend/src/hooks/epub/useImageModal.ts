/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useImageModal - Custom hook for managing image modal state
 *
 * Handles the modal state for displaying description images.
 * Includes image generation with status tracking and 409 error handling.
 *
 * @returns Modal state and control functions
 *
 * @example
 * const { selectedImage, isGenerating, openModal, closeModal } = useImageModal();
 * openModal(description, image);
 */

import { useState, useCallback, useRef } from 'react';
import type { Description, GeneratedImage } from '@/types/api';
import { imagesAPI } from '@/api/images';
import { notify } from '@/stores/ui';

export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error';

interface UseImageModalReturn {
  selectedImage: GeneratedImage | null;
  selectedDescription: Description | null;
  isOpen: boolean;
  isGenerating: boolean;
  generationStatus: GenerationStatus;
  generationError: string | null;
  descriptionPreview: string | null;
  openModal: (description: Description, image?: GeneratedImage) => Promise<void>;
  closeModal: () => void;
  updateImage: (newImageUrl: string) => void;
  cancelGeneration: () => void;
}

export const useImageModal = (): UseImageModalReturn => {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [selectedDescription, setSelectedDescription] = useState<Description | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [descriptionPreview, setDescriptionPreview] = useState<string | null>(null);

  // AbortController for cancelling generation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Open modal with description and optional image
   * If no image exists, generate it
   * Handles 409 (image exists) by fetching the existing image
   */
  const openModal = useCallback(async (description: Description, image?: GeneratedImage) => {
    console.log('🖼️ [useImageModal] Opening modal for description:', description.id);

    // Clear previous errors
    setGenerationError(null);
    setSelectedDescription(description);
    setDescriptionPreview(description.content?.substring(0, 100) || null);

    // If image already provided, just open modal
    if (image) {
      console.log('✅ [useImageModal] Image exists:', image.image_url);
      setSelectedImage(image);
      setIsOpen(true);
      setGenerationStatus('completed');
      return;
    }

    // Generate image if it doesn't exist
    console.log('🎨 [useImageModal] No image found, generating...');
    setIsGenerating(true);
    setGenerationStatus('generating');

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const result = await imagesAPI.generateImageForDescription(description.id);

      console.log('✅ [useImageModal] Image generated:', result.image_url);

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

      notify.success(
        'Изображение создано',
        `Сгенерировано за ${result.generation_time.toFixed(1)}с`
      );
    } catch (error: any) {
      console.error('❌ [useImageModal] Image generation failed:', error);

      // Handle 409 - image already exists
      if (error.response?.status === 409) {
        console.log('🔄 [useImageModal] Image already exists, fetching...');

        try {
          // Fetch existing image
          const existingImage = await imagesAPI.getImageForDescription(description.id);

          console.log('✅ [useImageModal] Fetched existing image:', existingImage.image_url);

          setSelectedImage(existingImage);
          setIsOpen(true);
          setGenerationStatus('completed');

          // Don't show warning - just open the modal silently
        } catch (fetchError: any) {
          console.error('❌ [useImageModal] Failed to fetch existing image:', fetchError);
          setGenerationError('Не удалось загрузить существующее изображение');
          setGenerationStatus('error');
          notify.error('Ошибка', 'Не удалось загрузить изображение');
        }
      } else {
        // Handle other errors
        const errorMessage = error.response?.data?.detail || 'Не удалось создать изображение';
        setGenerationError(errorMessage);
        setGenerationStatus('error');
        notify.error('Ошибка генерации', errorMessage);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Close modal and reset state
   */
  const closeModal = useCallback(() => {
    console.log('❌ [useImageModal] Closing modal');
    setIsOpen(false);
    // Don't clear selectedImage immediately - allow animation
    setTimeout(() => {
      setSelectedImage(null);
      setSelectedDescription(null);
      setGenerationError(null);
      setDescriptionPreview(null);
      // Don't reset status to idle - keep it for status bar to show completion
    }, 300);
  }, []);

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
    openModal,
    closeModal,
    updateImage,
    cancelGeneration,
  };
};
