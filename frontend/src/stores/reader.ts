import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { booksAPI } from '@/api/books';

export interface ReadingProgress {
  bookId: string;
  currentChapter: number;
  currentPage: number;
  progress: number; // 0-100
  lastReadAt: Date;
  totalTimeRead: number; // in seconds
}

interface ReaderState {
  // Settings
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: 'light' | 'dark' | 'sepia';
  backgroundColor: string;
  textColor: string;
  maxWidth: number;
  margin: number;
  
  // Reading state
  readingProgress: Record<string, ReadingProgress>;
  bookmarks: Record<string, { chapter: number; page: number; text: string; createdAt: Date }[]>;
  highlights: Record<string, { id: string; chapter: number; text: string; color: string; createdAt: Date }[]>;
  
  // Actions
  updateFontSize: (size: number) => void;
  updateFontFamily: (family: string) => void;
  updateLineHeight: (height: number) => void;
  updateTheme: (theme: 'light' | 'dark' | 'sepia') => void;
  updateReadingProgress: (bookId: string, chapter: number, progress: number, page?: number) => void;
  addBookmark: (bookId: string, chapter: number, page: number, text: string) => void;
  removeBookmark: (bookId: string, index: number) => void;
  addHighlight: (bookId: string, chapter: number, text: string, color: string) => void;
  removeHighlight: (bookId: string, highlightId: string) => void;
  resetSettings: () => void;
  getReadingProgress: (bookId: string) => ReadingProgress | null;
  getTotalReadingTime: () => number;
}

const themeSettings = {
  light: {
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
  },
  dark: {
    backgroundColor: '#111827',
    textColor: '#f9fafb',
  },
  sepia: {
    backgroundColor: '#f7f3e4',
    textColor: '#5d4e37',
  },
};

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      // Initial settings
      fontSize: 18,
      fontFamily: 'Georgia, serif',
      lineHeight: 1.6,
      theme: 'light',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      maxWidth: 800,
      margin: 40,
      
      // Initial state
      readingProgress: {},
      bookmarks: {},
      highlights: {},
      
      // Settings actions
      updateFontSize: (size: number) => {
        set({ fontSize: Math.max(12, Math.min(32, size)) });
      },
      
      updateFontFamily: (family: string) => {
        set({ fontFamily: family });
      },
      
      updateLineHeight: (height: number) => {
        set({ lineHeight: Math.max(1.2, Math.min(2.5, height)) });
      },
      
      updateTheme: (theme: 'light' | 'dark' | 'sepia') => {
        const settings = themeSettings[theme];
        set({ 
          theme, 
          backgroundColor: settings.backgroundColor,
          textColor: settings.textColor,
        });
      },
      
      // Reading progress actions
      updateReadingProgress: async (bookId: string, chapter: number, progress: number, page?: number) => {
        const currentProgress = get().readingProgress[bookId];
        const now = new Date();
        const actualPage = page || currentProgress?.currentPage || 1;
        
        const updatedProgress: ReadingProgress = {
          bookId,
          currentChapter: chapter,
          currentPage: actualPage,
          progress: Math.max(0, Math.min(100, progress)),
          lastReadAt: now,
          totalTimeRead: (currentProgress?.totalTimeRead || 0) + (currentProgress ? 
            (now.getTime() - new Date(currentProgress.lastReadAt).getTime()) / 1000 : 0),
        };
        
        set(state => ({
          readingProgress: {
            ...state.readingProgress,
            [bookId]: updatedProgress,
          },
        }));
        
        // Sync with server
        try {
          await booksAPI.updateReadingProgress(bookId, {
            current_chapter: chapter,
            current_page: actualPage,
          });
        } catch (error) {
          console.error('Failed to sync reading progress:', error);
        }
      },
      
      // Bookmarks actions
      addBookmark: (bookId: string, chapter: number, page: number, text: string) => {
        const bookmark = {
          chapter,
          page,
          text: text.slice(0, 200), // Limit text length
          createdAt: new Date(),
        };
        
        set(state => ({
          bookmarks: {
            ...state.bookmarks,
            [bookId]: [...(state.bookmarks[bookId] || []), bookmark],
          },
        }));
      },
      
      removeBookmark: (bookId: string, index: number) => {
        set(state => ({
          bookmarks: {
            ...state.bookmarks,
            [bookId]: (state.bookmarks[bookId] || []).filter((_, i) => i !== index),
          },
        }));
      },
      
      // Highlights actions
      addHighlight: (bookId: string, chapter: number, text: string, color: string = '#fbbf24') => {
        const highlight = {
          id: `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          chapter,
          text: text.slice(0, 500), // Limit text length
          color,
          createdAt: new Date(),
        };
        
        set(state => ({
          highlights: {
            ...state.highlights,
            [bookId]: [...(state.highlights[bookId] || []), highlight],
          },
        }));
      },
      
      removeHighlight: (bookId: string, highlightId: string) => {
        set(state => ({
          highlights: {
            ...state.highlights,
            [bookId]: (state.highlights[bookId] || []).filter(h => h.id !== highlightId),
          },
        }));
      },
      
      // Utility actions
      resetSettings: () => {
        set({
          fontSize: 18,
          fontFamily: 'Georgia, serif',
          lineHeight: 1.6,
          theme: 'light',
          backgroundColor: '#ffffff',
          textColor: '#1f2937',
          maxWidth: 800,
          margin: 40,
        });
      },
      
      getReadingProgress: (bookId: string) => {
        return get().readingProgress[bookId] || null;
      },
      
      getTotalReadingTime: () => {
        const progress = get().readingProgress;
        return Object.values(progress).reduce((total, p) => total + p.totalTimeRead, 0);
      },
    }),
    {
      name: 'reader-storage',
      partialize: (state) => ({
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        lineHeight: state.lineHeight,
        theme: state.theme,
        backgroundColor: state.backgroundColor,
        textColor: state.textColor,
        maxWidth: state.maxWidth,
        margin: state.margin,
        readingProgress: state.readingProgress,
        bookmarks: state.bookmarks,
        highlights: state.highlights,
      }),
    }
  )
);