// Images API methods

import { apiClient } from './client';
import { config } from '@/config/env';
import type {
  GeneratedImage,
  ImageGenerationParams,
  BatchGenerationRequest,
  GenerationStatus,
  DescriptionType,
} from '@/types/api';

/**
 * Normalizes image URL to absolute URL.
 * Converts relative API paths (e.g., /api/v1/images/file/xxx.png) to full URLs.
 */
function normalizeImageUrl(url: string | null | undefined): string {
  console.log('🔧 [normalizeImageUrl] Input URL:', url);
  console.log('🔧 [normalizeImageUrl] config.api.baseUrl:', config.api.baseUrl);

  if (!url) return '';

  // If URL is already absolute (starts with http:// or https://), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.log('🔧 [normalizeImageUrl] URL is absolute, returning as is');
    return url;
  }

  // If URL is a relative API path, prepend the base URL (without /api/v1 suffix)
  if (url.startsWith('/api/')) {
    // config.api.baseUrl is like "https://fancai.ru" (VITE_API_BASE_URL)
    // url is like "/api/v1/images/file/xxx.png"
    // Result: "https://fancai.ru/api/v1/images/file/xxx.png"
    const baseUrl = config.api.baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    const result = `${baseUrl}${url}`;
    console.log('🔧 [normalizeImageUrl] Converted to absolute:', result);
    return result;
  }

  // For other relative URLs, just return as is
  console.log('🔧 [normalizeImageUrl] Returning as is (other relative):', url);
  return url;
}

export const imagesAPI = {
  /**
   * Normalize image URL to absolute URL (exported for use in components)
   */
  normalizeImageUrl,
  // Get image for specific description
  async getImageForDescription(descriptionId: string): Promise<GeneratedImage> {
    const response = await apiClient.get(`/images/description/${descriptionId}`) as GeneratedImage;
    // Normalize image URL
    console.log('🔗 [imagesAPI] getImageForDescription - Raw image_url:', response.image_url);
    if (response.image_url) {
      const normalizedUrl = normalizeImageUrl(response.image_url);
      console.log('🔗 [imagesAPI] getImageForDescription - Normalized image_url:', normalizedUrl);
      response.image_url = normalizedUrl;
    }
    return response;
  },

  // Generation status
  async getGenerationStatus(): Promise<GenerationStatus> {
    return apiClient.get('/images/generation/status');
  },

  // User statistics
  async getUserStats(): Promise<{
    total_images_generated: number;
    total_descriptions_found: number;
  }> {
    return apiClient.get('/images/user/stats');
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
    const response = await apiClient.post(`/images/generate/description/${descriptionId}`, params) as {
      image_id: string;
      description_id: string;
      image_url: string;
      generation_time: number;
      status: string;
      created_at: string;
      message: string;
    };
    // Normalize image URL
    console.log('🔗 [imagesAPI] Raw image_url from backend:', response.image_url);
    if (response.image_url) {
      const normalizedUrl = normalizeImageUrl(response.image_url);
      console.log('🔗 [imagesAPI] Normalized image_url:', normalizedUrl);
      response.image_url = normalizedUrl;
    }
    return response;
  },

  // Check if image can be generated (no existing image)
  async canGenerateForDescription(descriptionId: string): Promise<boolean> {
    try {
      await this.generateImageForDescription(descriptionId, {});
      return true;
    } catch (error) {
      // If error is 409 (conflict), it means image already exists
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 409) {
          return false;
        }
      }
      // For other errors, assume we can try to generate
      return true;
    }
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
    const response = await apiClient.post(`/images/generate/chapter/${chapterId}`, request) as {
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
    };
    // Normalize image URLs
    if (response.images) {
      response.images = response.images.map(img => ({
        ...img,
        image_url: normalizeImageUrl(img.image_url),
      }));
    }
    return response;
  },

  // Image management
  async getBookImages(
    bookId: string,
    chapterNumber?: number,
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
    if (chapterNumber !== undefined) {
      params.append('chapter', chapterNumber.toString());
    }

    const response = await apiClient.get(`/images/book/${bookId}?${params.toString()}`) as {
      book_id: string;
      book_title: string;
      images: GeneratedImage[];
      pagination: {
        skip: number;
        limit: number;
        total_found: number;
      };
    };
    // Normalize image URLs
    if (response.images) {
      response.images = response.images.map(img => ({
        ...img,
        image_url: normalizeImageUrl(img.image_url),
      }));
    }
    return response;
  },

  async deleteImage(imageId: string): Promise<{ message: string }> {
    return apiClient.delete(`/images/${imageId}`);
  },

  // Regenerate existing image
  async regenerateImage(
    imageId: string,
    params: ImageGenerationParams = {}
  ): Promise<{
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
  }> {
    const response = await apiClient.post(`/images/regenerate/${imageId}`, params) as {
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
    };
    // Normalize image URL
    if (response.image_url) {
      response.image_url = normalizeImageUrl(response.image_url);
    }
    return response;
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