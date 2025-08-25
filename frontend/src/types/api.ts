// API Types for BookReader AI Frontend

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface PaginationParams {
  skip?: number;
  limit?: number;
}

export interface PaginationResponse {
  total: number;
  skip: number;
  limit: number;
  has_more?: boolean;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
  last_login?: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  message: string;
}

// Book Types
export interface BookMetadata {
  title: string;
  author: string;
  language?: string;
  genre?: string;
  description?: string;
  publisher?: string;
  publish_date?: string;
  has_cover: boolean;
}

export interface BookStatistics {
  total_chapters: number;
  total_pages: number;
  estimated_reading_time_hours: number;
  file_format: string;
  file_size_mb: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  language?: string;
  description?: string;
  total_pages: number;
  estimated_reading_time_hours: number;
  chapters_count: number;
  reading_progress_percent: number;
  has_cover: boolean;
  is_parsed: boolean;
  created_at: string;
  last_accessed?: string;
}

export interface Chapter {
  id: string;
  book_id: string;
  number: number;
  title: string;
  content: string;
  word_count: number;
  estimated_reading_time_minutes: number;
  html_content?: string;
}

export interface ChapterInfo {
  id: string;
  number: number;
  title: string;
  word_count: number;
  estimated_reading_time_minutes: number;
  is_description_parsed: boolean;
  descriptions_found: number;
}

export interface BookDetail extends Book {
  chapters: ChapterInfo[];
  reading_progress: {
    current_chapter: number;
    current_page: number;
    progress_percent: number;
  };
  file_format: string;
  file_size_mb: number;
  parsing_progress: number;
  total_chapters: number;
}

export interface BookUploadResponse {
  book_id: string;
  title: string;
  author: string;
  chapters_count: number;
  total_pages: number;
  estimated_reading_time_hours: number;
  file_size_mb: number;
  has_cover: boolean;
  created_at: string;
  message: string;
}

// Description Types
export type DescriptionType = 'location' | 'character' | 'atmosphere' | 'object' | 'action';

export interface Description {
  id: string;
  type: DescriptionType;
  text: string;
  content: string;
  confidence_score: number;
  priority_score: number;
  entities_mentioned: string[];
  generated_image?: GeneratedImage;
}

export interface NLPAnalysis {
  total_descriptions: number;
  by_type: Record<DescriptionType, number>;
  descriptions: Description[];
}

// Image Generation Types
export interface GeneratedImage {
  id: string;
  description_id: string;
  image_url: string;
  generation_time: number;
  created_at: string;
  description?: {
    id: string;
    type: DescriptionType;
    content: string;
    priority_score: number;
  };
  chapter?: {
    id: string;
    number: number;
    title: string;
  };
}

export interface ImageGenerationParams {
  style_prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
}

export interface BatchGenerationRequest {
  chapter_id: string;
  max_images: number;
  style_prompt?: string;
  description_types?: DescriptionType[];
}

export interface GenerationStatus {
  status: string;
  queue_stats: {
    queue_size: number;
    is_processing: boolean;
    supported_types: DescriptionType[];
    api_status: string;
  };
  user_info: {
    id: string;
    can_generate: boolean;
  };
  api_info: {
    provider: string;
    supported_formats: string[];
    max_resolution: string;
    estimated_time_per_image: string;
  };
}

// Subscription Types
export type SubscriptionPlan = 'free' | 'premium' | 'ultimate';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  start_date: string;
  end_date?: string;
  auto_renewal: boolean;
}

export interface SubscriptionUsage {
  books_uploaded: number;
  images_generated_month: number;
  last_reset_date: string;
}

export interface SubscriptionLimits {
  books: number; // -1 for unlimited
  generations_month: number; // -1 for unlimited
}

export interface UserProfile {
  user: User;
  subscription?: Subscription;
  statistics: {
    total_books: number;
    total_descriptions: number;
  };
}

export interface UserSubscriptionInfo {
  subscription: Subscription;
  usage: SubscriptionUsage;
  limits: SubscriptionLimits;
  within_limits: {
    books: boolean;
    generations: boolean;
  };
}

// Error Types
export interface ApiError {
  error: string;
  message: string;
  details?: any;
  timestamp?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Reading Progress Types
export interface ReadingProgress {
  book_id: string;
  current_page: number;
  current_chapter: number;
  progress_percent: number;
  last_read_at: string;
}