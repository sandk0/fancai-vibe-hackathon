/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useImageModal - Custom hook for managing image modal state
 *
 * Handles the modal state for displaying description images.
 *
 * @returns Modal state and control functions
 *
 * @example
 * const { selectedImage, openModal, closeModal, updateImage } = useImageModal();
 * openModal(description, image);
 */

import { useState, useCallback } from 'react';
import type { Description, GeneratedImage } from '@/types/api';
import { imagesAPI } from '@/api/images';
import { notify } from '@/stores/ui';

interface UseImageModalReturn {
  selectedImage: GeneratedImage | null;
  selectedDescription: Description | null;
  isOpen: boolean;
  openModal: (description: Description, image?: GeneratedImage) => Promise<void>;
  closeModal: () => void;
  updateImage: (newImageUrl: string) => void;
}

export const useImageModal = (): UseImageModalReturn => {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [selectedDescription, setSelectedDescription] = useState<Description | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Open modal with description and optional image
   * If no image exists, generate it
   */
  const openModal = useCallback(async (description: Description, image?: GeneratedImage) => {
    console.log('🖼️ [useImageModal] Opening modal for description:', description.id);

    setSelectedDescription(description);

    if (image) {
      console.log('✅ [useImageModal] Image exists:', image.image_url);
      setSelectedImage(image);
      setIsOpen(true);
      return;
    }

    // Generate image if it doesn't exist
    console.log('🎨 [useImageModal] No image found, generating...');

    try {
      notify.info('Генерация изображения', 'Создаем изображение для описания...');

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

      notify.success(
        'Изображение создано',
        `Сгенерировано за ${result.generation_time.toFixed(1)}с`
      );
    } catch (error: any) {
      console.error('❌ [useImageModal] Image generation failed:', error);

      if (error.response?.status === 409) {
        notify.warning('Изображение существует', 'Изображение уже было сгенерировано');
      } else {
        notify.error('Ошибка генерации', 'Не удалось создать изображение');
      }
    }
  }, []);

  /**
   * Close modal
   */
  const closeModal = useCallback(() => {
    console.log('❌ [useImageModal] Closing modal');
    setIsOpen(false);
    setSelectedImage(null);
    setSelectedDescription(null);
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
    openModal,
    closeModal,
    updateImage,
  };
};
