// Images Store

import { create } from 'zustand';
import { imagesAPI } from '@/api/images';
import type { ImagesState } from '@/types/state';

export const useImagesStore = create<ImagesState>((set, get) => ({
  // Initial state
  images: [],
  currentBookImages: [],
  generationStatus: null,
  isGenerating: false,
  isLoading: false,
  error: null,

  // Actions
  fetchGenerationStatus: async () => {
    set({ isLoading: true, error: null });

    try {
      const status = await imagesAPI.getGenerationStatus();
      set({ 
        generationStatus: status,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to fetch generation status' 
      });
      throw error;
    }
  },

  generateImageForDescription: async (descriptionId: string, params = {}) => {
    set({ isGenerating: true, error: null });

    try {
      const response = await imagesAPI.generateImageForDescription(descriptionId, params);
      
      // Add the new image to the current list
      const newImage = {
        id: response.image_id,
        description_id: response.description_id,
        image_url: response.image_url,
        generation_time: response.generation_time,
        created_at: response.created_at,
      };

      set({ 
        images: [newImage, ...get().images],
        isGenerating: false 
      });

      return response;
    } catch (error: any) {
      set({ 
        isGenerating: false, 
        error: error.message || 'Failed to generate image' 
      });
      throw error;
    }
  },

  generateImagesForChapter: async (chapterId: string, params = {}) => {
    set({ isGenerating: true, error: null });

    try {
      const response = await imagesAPI.generateImagesForChapter(chapterId, params);
      
      // Convert response images to our format
      const newImages = response.images.map(img => ({
        id: `generated-${Date.now()}-${Math.random()}`, // Temporary ID
        description_id: img.description_id,
        image_url: img.image_url,
        generation_time: img.generation_time,
        created_at: new Date().toISOString(),
        description: {
          id: img.description_id,
          type: img.description_type,
          content: '',
          priority_score: 0,
        }
      }));

      set({ 
        images: [...newImages, ...get().images],
        isGenerating: false 
      });

      return response;
    } catch (error: any) {
      set({ 
        isGenerating: false, 
        error: error.message || 'Failed to generate images for chapter' 
      });
      throw error;
    }
  },

  fetchBookImages: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await imagesAPI.getBookImages(bookId);
      set({ 
        currentBookImages: response.images,
        isLoading: false 
      });
    } catch (error: any) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to fetch book images' 
      });
      throw error;
    }
  },

  deleteImage: async (imageId: string) => {
    set({ isLoading: true, error: null });

    try {
      await imagesAPI.deleteImage(imageId);

      // Remove image from current lists
      const { images, currentBookImages } = get();
      set({
        images: images.filter(img => img.id !== imageId),
        currentBookImages: currentBookImages.filter(img => img.id !== imageId),
        isLoading: false,
      });
    } catch (error: any) {
      set({ 
        isLoading: false, 
        error: error.message || 'Failed to delete image' 
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));