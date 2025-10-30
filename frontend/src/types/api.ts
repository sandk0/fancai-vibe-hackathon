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
  descriptions?: Description[];
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
    current_position: number;  // Процент позиции в текущей главе (0-100)
    reading_location_cfi?: string;  // CFI для epub.js (точная позиция в EPUB)
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
  is_processing?: boolean;
}

// Description Types
export type DescriptionType = 'location' | 'character' | 'atmosphere' | 'object' | 'action';

export interface Description {
  id: string;
  type: DescriptionType;
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
export interface ImageDescription {
  id: string;
  type: DescriptionType;
  text: string;  // Полный текст описания
  content: string;  // Сокращенный текст
  confidence_score: number;
  priority_score: number;
  entities_mentioned?: string[];
}

export interface ImageChapter {
  id: string;
  number: number;
  title: string;
}

export interface GeneratedImage {
  id: string;

  // Генерация
  service_used: string;
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'moderated';
  prompt_used?: string;
  generation_time_seconds?: number;

  // Результат
  image_url: string;
  local_path?: string;

  // Файл
  file_size?: number;
  image_width?: number;
  image_height?: number;
  file_format?: string;

  // Качество
  quality_score?: number;
  is_moderated: boolean;

  // Статистика
  view_count: number;
  download_count: number;

  // Timestamps
  created_at: string;
  updated_at?: string;
  generated_at?: string;

  // Relationships
  description: ImageDescription;
  chapter: ImageChapter;
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
  current_position: number;  // Процент позиции в текущей главе (0-100)
  reading_location_cfi?: string;  // CFI для epub.js (точная позиция в EPUB)
  scroll_offset_percent?: number;  // Точный % скролла внутри страницы (0-100)
  progress_percent: number;
  last_read_at: string;
}

// User Reading Statistics Types
export interface WeeklyActivityDay {
  date: string;          // "2025-10-26"
  day: string;           // "Вс"
  minutes: number;       // 45
  sessions: number;      // 2
  progress: number;      // 12 (% прогресса за день)
}

export interface FavoriteGenre {
  genre: string;
  count: number;
}

export interface UserReadingStatistics {
  total_books: number;
  books_in_progress: number;
  books_completed: number;
  total_reading_time_minutes: number;
  reading_streak_days: number;
  average_reading_speed_wpm: number;
  favorite_genres: FavoriteGenre[];
  weekly_activity: WeeklyActivityDay[];
  total_pages_read: number;
  total_chapters_read: number;
}

// Reading Session Types
export interface ReadingSession {
  id: string;
  book_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  start_position: number;
  end_position: number;
  pages_read: number;
  device_type?: string;
  is_active: boolean;
}

export interface StartSessionRequest {
  book_id: string;
  start_position: number;
  device_type?: string;
}

export interface UpdateSessionRequest {
  current_position: number;
}

export interface EndSessionRequest {
  end_position: number;
}

export interface ReadingSessionHistory {
  sessions: ReadingSession[];
  total: number;
  skip: number;
  limit: number;
}