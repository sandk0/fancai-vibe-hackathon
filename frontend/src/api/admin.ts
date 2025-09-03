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

export interface NLPSettings {
  min_description_length: number;
  min_word_count: number;
  max_description_length: number;
  min_sentence_length: number;
  confidence_threshold: number;
  model_name: string;
  available_models: string[];
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

export const adminAPI = {
  // System stats
  async getSystemStats(): Promise<SystemStats> {
    return apiClient.get('/admin/stats');
  },

  // NLP settings
  async getNLPSettings(): Promise<NLPSettings> {
    return apiClient.get('/admin/nlp-settings');
  },

  async updateNLPSettings(settings: NLPSettings): Promise<{ message: string; settings: NLPSettings }> {
    return apiClient.put('/admin/nlp-settings', settings);
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
  }
};