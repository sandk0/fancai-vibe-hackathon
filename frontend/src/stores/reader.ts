// Reader Settings Store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReaderState } from '@/types/state';
import { STORAGE_KEYS } from '@/types/state';

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      // Default settings
      fontSize: 16,
      fontFamily: 'serif',
      theme: 'light',
      lineHeight: 1.6,
      wordsPerPage: 350,
      
      // Reading state
      currentPage: 1,
      totalPages: 0,
      isFullscreen: false,
      showImages: true,
      autoScroll: false,

      // Actions
      setFontSize: (size) => {
        if (size >= 12 && size <= 32) {
          set({ fontSize: size });
        }
      },

      setFontFamily: (family) => {
        set({ fontFamily: family });
      },

      setTheme: (theme) => {
        set({ theme });
        
        // Apply theme to document
        const root = document.documentElement;
        root.classList.remove('light', 'dark', 'sepia');
        root.classList.add(theme);
        
        // Store theme separately for immediate access
        localStorage.setItem(STORAGE_KEYS.THEME, theme);
      },

      setLineHeight: (height) => {
        if (height >= 1.0 && height <= 3.0) {
          set({ lineHeight: height });
        }
      },

      setWordsPerPage: (words) => {
        if (words >= 100 && words <= 1000) {
          set({ wordsPerPage: words });
        }
      },

      setCurrentPage: (page) => {
        const { totalPages } = get();
        if (page >= 1 && page <= totalPages) {
          set({ currentPage: page });
        }
      },

      setTotalPages: (pages) => {
        set({ totalPages: pages });
      },

      toggleFullscreen: () => {
        const { isFullscreen } = get();
        set({ isFullscreen: !isFullscreen });
        
        if (!isFullscreen) {
          // Enter fullscreen
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
          }
        } else {
          // Exit fullscreen
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      },

      toggleShowImages: () => {
        set({ showImages: !get().showImages });
      },

      toggleAutoScroll: () => {
        set({ autoScroll: !get().autoScroll });
      },

      nextPage: () => {
        const { currentPage, totalPages } = get();
        if (currentPage < totalPages) {
          set({ currentPage: currentPage + 1 });
        }
      },

      previousPage: () => {
        const { currentPage } = get();
        if (currentPage > 1) {
          set({ currentPage: currentPage - 1 });
        }
      },

      goToPage: (page) => {
        get().setCurrentPage(page);
      },

      resetSettings: () => {
        set({
          fontSize: 16,
          fontFamily: 'serif',
          theme: 'light',
          lineHeight: 1.6,
          wordsPerPage: 350,
          isFullscreen: false,
          showImages: true,
          autoScroll: false,
        });
      },
    }),
    {
      name: 'reader-settings',
      partialize: (state) => ({
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        theme: state.theme,
        lineHeight: state.lineHeight,
        wordsPerPage: state.wordsPerPage,
        showImages: state.showImages,
        autoScroll: state.autoScroll,
      }),
    }
  )
);