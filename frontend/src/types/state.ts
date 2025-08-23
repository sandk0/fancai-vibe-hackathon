// State Management Types for BookReader AI

import { User, Book, Chapter, GeneratedImage, UserProfile, GenerationStatus } from './api';

// Auth Store State
export interface AuthState {
  // Authentication state
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  updateUser: (user: User) => void;
  loadUserFromStorage: () => void;
}

// Books Store State  
export interface BooksState {
  // Books data
  books: Book[];
  currentBook: Book | null;
  currentChapter: Chapter | null;
  isLoading: boolean;
  error: string | null;
  
  // Pagination
  totalBooks: number;
  currentPage: number;
  booksPerPage: number;
  hasMore: boolean;
  
  // Actions
  fetchBooks: (page?: number, limit?: number) => Promise<void>;
  fetchBook: (bookId: string) => Promise<void>;
  fetchChapter: (bookId: string, chapterNumber: number) => Promise<void>;
  uploadBook: (file: File) => Promise<void>;
  deleteBook: (bookId: string) => Promise<void>;
  updateReadingProgress: (bookId: string, currentPage: number, chapterNumber: number) => Promise<void>;
  setCurrentBook: (book: Book | null) => void;
  setCurrentChapter: (chapter: Chapter | null) => void;
  clearError: () => void;
}

// Images Store State
export interface ImagesState {
  // Images data
  images: GeneratedImage[];
  currentBookImages: GeneratedImage[];
  generationStatus: GenerationStatus | null;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchGenerationStatus: () => Promise<void>;
  generateImageForDescription: (descriptionId: string, params?: any) => Promise<void>;
  generateImagesForChapter: (chapterId: string, params?: any) => Promise<void>;
  fetchBookImages: (bookId: string) => Promise<void>;
  deleteImage: (imageId: string) => Promise<void>;
  clearError: () => void;
}

// Reader Store State
export interface ReaderState {
  // Reader settings
  fontSize: number; // 14, 16, 18, 20, 24
  fontFamily: 'sans' | 'serif' | 'mono';
  theme: 'light' | 'dark' | 'sepia';
  lineHeight: number; // 1.2, 1.4, 1.6, 1.8, 2.0
  wordsPerPage: number; // 250, 350, 450, 550
  
  // Reading state
  currentPage: number;
  totalPages: number;
  isFullscreen: boolean;
  showImages: boolean;
  autoScroll: boolean;
  
  // Actions
  setFontSize: (size: number) => void;
  setFontFamily: (family: 'sans' | 'serif' | 'mono') => void;
  setTheme: (theme: 'light' | 'dark' | 'sepia') => void;
  setLineHeight: (height: number) => void;
  setWordsPerPage: (words: number) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  toggleFullscreen: () => void;
  toggleShowImages: () => void;
  toggleAutoScroll: () => void;
  nextPage: () => void;
  previousPage: () => void;
  goToPage: (page: number) => void;
  resetSettings: () => void;
}

// UI Store State
export interface UIState {
  // General UI state
  isLoading: boolean;
  loadingMessage: string;
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  
  // Modals and dialogs
  showUploadModal: boolean;
  showSettingsModal: boolean;
  showImageModal: boolean;
  showProfileModal: boolean;
  currentImageModal: GeneratedImage | null;
  
  // Notifications
  notifications: Notification[];
  
  // Actions
  setLoading: (loading: boolean, message?: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setShowUploadModal: (show: boolean) => void;
  setShowSettingsModal: (show: boolean) => void;
  setShowImageModal: (show: boolean, image?: GeneratedImage | null) => void;
  setShowProfileModal: (show: boolean) => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// Notification Type
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
  duration?: number; // auto-dismiss time in ms, undefined for persistent
}

// Profile Store State
export interface ProfileState {
  // Profile data
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchProfile: () => Promise<void>;
  updateProfile: (data: { full_name?: string; current_password?: string; new_password?: string }) => Promise<void>;
  clearError: () => void;
}

// Combined App State (for providers/context if needed)
export interface AppState {
  auth: AuthState;
  books: BooksState;
  images: ImagesState;
  reader: ReaderState;
  ui: UIState;
  profile: ProfileState;
}

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'bookreader_access_token',
  REFRESH_TOKEN: 'bookreader_refresh_token',
  USER_DATA: 'bookreader_user_data',
  READER_SETTINGS: 'bookreader_reader_settings',
  THEME: 'bookreader_theme',
} as const;

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  LIBRARY: '/library',
  BOOK: '/book/:bookId',
  CHAPTER: '/book/:bookId/chapter/:chapterNumber',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  ADMIN: '/admin',
} as const;