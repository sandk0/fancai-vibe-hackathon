// Admin API methods

import { apiClient } from './client';

export interface SystemStats {
  total_users: number;
  total_books: number;
  total_descriptions: number;
  total_images: number;
  processing_rate: number;
  generation_rate: number;
  active_parsing_tasks: number;
  queue_size: number;
}


export interface MultiNLPSettings {
  processing_mode: string;
  default_processor: string;
  max_parallel_processors: number;
  ensemble_voting_threshold: number;
  adaptive_text_analysis: boolean;
  quality_monitoring: boolean;
  auto_processor_selection: boolean;
  spacy_settings: {
    enabled: boolean;
    weight: number;
    confidence_threshold: number;
    model_name: string;
    literary_patterns: boolean;
    character_detection_boost: number;
    location_detection_boost: number;
  };
  natasha_settings: {
    enabled: boolean;
    weight: number;
    confidence_threshold: number;
    literary_boost: number;
    enable_morphology: boolean;
    enable_syntax: boolean;
    enable_ner: boolean;
  };
  stanza_settings: {
    enabled: boolean;
    weight: number;
    confidence_threshold: number;
  };
  processor_type: string;
  available_processors: string[];
  available_spacy_models: string[];
}

export interface ParsingSettings {
  max_concurrent_parsing: number;
  queue_priority_weights: {
    free: number;
    premium: number;
    ultimate: number;
  };
  timeout_minutes: number;
  retry_attempts: number;
}

export interface ImageGenerationSettings {
  primary_service: string;
  fallback_services: string[];
  enable_caching: boolean;
  image_quality: string;
  max_generation_time: number;
}

export interface SystemSettings {
  maintenance_mode: boolean;
  max_upload_size_mb: number;
  supported_book_formats: string[];
  enable_debug_mode: boolean;
}

export const adminAPI = {
  // System stats
  async getSystemStats(): Promise<SystemStats> {
    return apiClient.get('/admin/stats');
  },


  // Multi-NLP settings
  async getMultiNLPSettings(): Promise<MultiNLPSettings> {
    return apiClient.get('/admin/multi-nlp-settings');
  },

  async updateMultiNLPSettings(settings: MultiNLPSettings): Promise<{ message: string; settings: MultiNLPSettings }> {
    return apiClient.put('/admin/multi-nlp-settings', settings);
  },

  // Parsing settings
  async getParsingSettings(): Promise<ParsingSettings> {
    return apiClient.get('/admin/parsing-settings');
  },

  async updateParsingSettings(settings: ParsingSettings): Promise<{ message: string; settings: ParsingSettings }> {
    return apiClient.put('/admin/parsing-settings', settings);
  },

  // User management
  async getUsers(skip: number = 0, limit: number = 50): Promise<{
    users: Array<{
      id: string;
      email: string;
      username: string;
      subscription_plan: string;
      is_active: boolean;
      is_admin: boolean;
      created_at: string;
      last_login: string | null;
    }>;
    total: number;
    skip: number;
    limit: number;
  }> {
    const params = new URLSearchParams();
    if (skip > 0) params.append('skip', skip.toString());
    if (limit !== 50) params.append('limit', limit.toString());
    
    const url = `/admin/users${params.toString() ? '?' + params.toString() : ''}`;
    return apiClient.get(url);
  },

  // Queue management
  async getQueueStatus(): Promise<{
    is_parsing_active: boolean;
    current_parsing: any;
    queue_size: number;
    queue_items: any[];
    error?: string;
  }> {
    return apiClient.get('/admin/queue-status');
  },

  async clearQueue(): Promise<{ message: string }> {
    return apiClient.post('/admin/clear-queue');
  },

  async unlockParsing(): Promise<{ message: string }> {
    return apiClient.post('/admin/unlock-parsing');
  },

  // Image generation settings
  async getImageGenerationSettings(): Promise<ImageGenerationSettings> {
    return apiClient.get('/admin/image-generation-settings');
  },

  async updateImageGenerationSettings(settings: ImageGenerationSettings): Promise<{ message: string; settings: ImageGenerationSettings }> {
    return apiClient.put('/admin/image-generation-settings', settings);
  },

  // System settings
  async getSystemSettings(): Promise<SystemSettings> {
    return apiClient.get('/admin/system-settings');
  },

  async updateSystemSettings(settings: SystemSettings): Promise<{ message: string; settings: SystemSettings }> {
    return apiClient.put('/admin/system-settings', settings);
  },

  // Initialize default settings
  async initializeSettings(): Promise<{ message: string }> {
    return apiClient.post('/admin/initialize-settings');
  },

  // NLP processor info
  async getNLPProcessorInfo(): Promise<{
    processor_info: {
      type: string;
      loaded: boolean;
      available: boolean;
      model?: string;
    };
    available_models: Record<string, string[]>;
  }> {
    return apiClient.get('/admin/nlp-processor-info');
  }
};