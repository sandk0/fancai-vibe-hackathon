// Images API methods

import { apiClient } from './client';
import type {
  GeneratedImage,
  ImageGenerationParams,
  BatchGenerationRequest,
  GenerationStatus,
  DescriptionType,
} from '@/types/api';

export const imagesAPI = {
  // Generation status
  async getGenerationStatus(): Promise<GenerationStatus> {
    return apiClient.get('/images/generation/status');
  },

  // Image generation
  async generateImageForDescription(
    descriptionId: string,
    params: ImageGenerationParams = {}
  ): Promise<{
    image_id: string;
    description_id: string;
    image_url: string;
    generation_time: number;
    status: string;
    created_at: string;
    message: string;
  }> {
    return apiClient.post(`/images/generate/description/${descriptionId}`, params);
  },

  async generateImagesForChapter(
    chapterId: string,
    request: BatchGenerationRequest
  ): Promise<{
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
  }> {
    return apiClient.post(`/images/generate/chapter/${chapterId}`, request);
  },

  // Image management
  async getBookImages(
    bookId: string,
    skip: number = 0,
    limit: number = 50
  ): Promise<{
    book_id: string;
    book_title: string;
    images: GeneratedImage[];
    pagination: {
      skip: number;
      limit: number;
      total_found: number;
    };
  }> {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    
    return apiClient.get(`/images/book/${bookId}?${params.toString()}`);
  },

  async deleteImage(imageId: string): Promise<{ message: string }> {
    return apiClient.delete(`/images/${imageId}`);
  },

  // Admin endpoints (require admin privileges)
  async getAdminImageStats(): Promise<{
    total_images_generated: number;
    generation_by_type: Record<DescriptionType, number>;
    performance: {
      average_generation_time_seconds: number;
      current_queue_size: number;
      is_processing: boolean;
    };
    system_status: {
      service_operational: boolean;
      api_provider: string;
      supported_types: DescriptionType[];
    };
  }> {
    return apiClient.get('/images/admin/stats');
  },

  // Utility methods for frontend
  async preloadImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
      img.src = imageUrl;
    });
  },

  async downloadImage(imageUrl: string, filename: string): Promise<void> {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      throw new Error(`Failed to download image: ${error}`);
    }
  },

  // Image optimization for display
  getOptimizedImageUrl(
    originalUrl: string, 
    options: { 
      width?: number; 
      height?: number; 
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
    } = {}
  ): string {
    // For pollinations.ai, we can add URL parameters for optimization
    if (originalUrl.includes('pollinations.ai')) {
      const url = new URL(originalUrl);
      if (options.width) url.searchParams.set('width', options.width.toString());
      if (options.height) url.searchParams.set('height', options.height.toString());
      if (options.quality) url.searchParams.set('quality', options.quality.toString());
      return url.toString();
    }
    
    return originalUrl;
  },

  // Get image placeholder while loading
  getImagePlaceholder(width: number = 400, height: number = 300): string {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="14" 
              fill="#9ca3af" text-anchor="middle" dy=".3em">
          Generating image...
        </text>
      </svg>
    `)}`;
  },
};