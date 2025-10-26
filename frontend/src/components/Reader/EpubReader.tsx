/**
 * EpubReader - Professional EPUB reading component with advanced features
 *
 * Reduced from 841 lines to modular hooks architecture.
 *
 * Core Features:
 * - EPUB.js integration for professional book rendering
 * - CFI-based position tracking with pixel-perfect restoration
 * - IndexedDB caching for instant location generation (5-10s → <100ms)
 * - Debounced progress sync (60 req/s → 0.2 req/s)
 * - Description highlighting with image modal
 * - Memory leak prevention via proper cleanup
 *
 * User Customization:
 * - Theme switcher (☀️ Light / 🌙 Dark / 📜 Sepia) with localStorage
 * - Font size controls (75%-200%, A-/A+ buttons) with localStorage
 * - Visual progress indicator (percentage, chapter, page)
 *
 * Navigation:
 * - Keyboard: ← ↑ (prev) / → ↓ Space (next)
 * - Touch/Swipe: Swipe left (next) / Swipe right (prev)
 * - Buttons: Click navigation arrows
 *
 * Advanced epub.js Features:
 * - Content hooks for custom CSS injection
 * - Theme-aware styling
 * - Image optimization and error handling
 * - Improved typography (justified text, hyphenation, spacing)
 *
 * @component
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { booksAPI } from '@/api/books';
import { STORAGE_KEYS } from '@/types/state';
import type { BookDetail } from '@/types/api';
import { ImageModal } from '@/components/Images/ImageModal';

// Import custom hooks
import {
  useEpubLoader,
  useLocationGeneration,
  useCFITracking,
  useProgressSync,
  useEpubNavigation,
  useKeyboardNavigation,
  useChapterManagement,
  useDescriptionHighlighting,
  useImageModal,
  useEpubThemes,
  useTouchNavigation,
  useContentHooks,
} from '@/hooks/epub';

// Import components
import { ProgressIndicator } from './ProgressIndicator';

interface EpubReaderProps {
  book: BookDetail;
}

export const EpubReader: React.FC<EpubReaderProps> = ({ book }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [renditionReady, setRenditionReady] = useState(false);
  const hasRestoredPosition = useRef(false);

  // Get auth token
  const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

  // Hook 1: Load EPUB file and create rendition
  const { book: epubBook, rendition, isLoading, error } = useEpubLoader({
    bookUrl: booksAPI.getBookFileUrl(book.id),
    viewerRef,
    authToken,
    onReady: () => {
      setTimeout(() => {
        setRenditionReady(true);
      }, 500);
    },
  });

  // Hook 2: Generate or load cached locations
  const { locations, isGenerating } = useLocationGeneration(epubBook, book.id);

  // Hook 3: Track CFI position and progress
  const { currentCFI, progress, scrollOffsetPercent, goToCFI, skipNextRelocated } = useCFITracking({
    rendition,
    locations,
    book: epubBook,
  });

  // Hook 4: Manage chapter tracking and load descriptions/images
  const { currentChapter, descriptions, images } = useChapterManagement({
    book: epubBook,
    rendition,
    bookId: book.id,
  });

  // Hook 5: Debounced progress sync to backend
  useProgressSync({
    bookId: book.id,
    currentCFI,
    progress,
    scrollOffset: scrollOffsetPercent,
    currentChapter,
    onSave: async (cfi, prog, scroll, chapter) => {
      await booksAPI.updateReadingProgress(book.id, {
        current_chapter: chapter,
        current_position_percent: prog,
        reading_location_cfi: cfi,
        scroll_offset_percent: scroll,
      });
    },
    enabled: renditionReady && !isGenerating,
  });

  // Hook 6: Page navigation
  const { nextPage, prevPage } = useEpubNavigation(rendition);

  // Hook 7: Image modal management
  const { selectedImage, isOpen: isModalOpen, openModal, closeModal, updateImage } = useImageModal();

  // Hook 8: Keyboard navigation (disabled when modal is open)
  useKeyboardNavigation(nextPage, prevPage, renditionReady && !isModalOpen);

  // Hook 9: Theme management
  const { theme, fontSize, setTheme, setFontSize, increaseFontSize, decreaseFontSize } = useEpubThemes(rendition);

  // Hook 10: Touch/swipe navigation
  useTouchNavigation({
    rendition,
    nextPage,
    prevPage,
    enabled: renditionReady && !isModalOpen,
  });

  // Hook 11: Content hooks for style injection
  useContentHooks(rendition, theme);

  // Hook 12: Description highlighting
  useDescriptionHighlighting({
    rendition,
    descriptions,
    images,
    onDescriptionClick: async (desc, img) => {
      await openModal(desc, img);
    },
    enabled: renditionReady && descriptions.length > 0,
  });

  /**
   * Initial display - show first page immediately when rendition is ready
   */
  useEffect(() => {
    if (!rendition || !renditionReady) return;

    let isMounted = true;

    const displayInitial = async () => {
      try {
        console.log('📖 [EpubReader] Displaying initial page...');
        await rendition.display();
        console.log('✅ [EpubReader] Initial page displayed');
      } catch (err) {
        console.error('❌ [EpubReader] Error displaying initial page:', err);
      }
    };

    displayInitial();

    return () => {
      isMounted = false;
    };
  }, [rendition, renditionReady]);

  /**
   * Restore reading position when locations are ready
   * IMPORTANT: Only runs ONCE on initial load, not on every navigation
   */
  useEffect(() => {
    if (!rendition || !locations || !epubBook || !renditionReady) return;

    // Skip if already restored position
    if (hasRestoredPosition.current) {
      console.log('⏭️ [EpubReader] Position already restored, skipping');
      return;
    }

    let isMounted = true;

    const restorePosition = async () => {
      try {
        const { progress: savedProgress } = await booksAPI.getReadingProgress(book.id);

        if (savedProgress?.reading_location_cfi && isMounted) {
          console.log('📖 [EpubReader] Restoring saved position:', {
            cfi: savedProgress.reading_location_cfi.substring(0, 80) + '...',
            progress: savedProgress.current_position + '%',
            scrollOffset: savedProgress.scroll_offset_percent || 0,
          });

          skipNextRelocated(); // Skip auto-save on restored position
          await goToCFI(savedProgress.reading_location_cfi, savedProgress.scroll_offset_percent || 0);

          // Mark as restored
          hasRestoredPosition.current = true;
          console.log('✅ [EpubReader] Position restoration complete');
        }
      } catch (err) {
        console.error('❌ [EpubReader] Error restoring position:', err);
      }
    };

    restorePosition();

    return () => {
      isMounted = false;
    };
  }, [rendition, locations, epubBook, renditionReady, book.id, goToCFI, skipNextRelocated]);

  /**
   * Handle image regeneration
   */
  const handleImageRegenerated = useCallback((newImageUrl: string) => {
    updateImage(newImageUrl);
  }, [updateImage]);

  // Get background color based on theme
  const getBackgroundColor = () => {
    switch (theme) {
      case 'light':
        return 'bg-white';
      case 'sepia':
        return 'bg-amber-50';
      case 'dark':
      default:
        return 'bg-gray-900';
    }
  };

  // Main render - viewerRef MUST stay in same DOM location to prevent rendition destruction
  return (
    <div className={`relative h-full w-full transition-colors ${getBackgroundColor()}`}>
      {/* EPUB Viewer - Always rendered in same location */}
      <div ref={viewerRef} className="h-full w-full" />

      {/* Loading Overlay */}
      {(isLoading || isGenerating) && (
        <div className={`absolute inset-0 flex items-center justify-center ${getBackgroundColor()} z-10`}>
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className={theme === 'light' ? 'text-gray-700' : 'text-gray-300'}>
              {isGenerating ? 'Подготовка книги...' : 'Загрузка книги...'}
            </p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className={`absolute inset-0 flex items-center justify-center ${getBackgroundColor()} z-10`}>
          <div className="text-center">
            <p className="text-red-400 mb-4">Ошибка загрузки книги</p>
            <p className={theme === 'light' ? 'text-gray-600' : 'text-gray-400 text-sm'}>{error}</p>
          </div>
        </div>
      )}

      {/* Reader Controls Toolbar */}
      {renditionReady && !isLoading && !isGenerating && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-gray-800/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          {/* Theme Switcher */}
          <div className="flex items-center gap-1 border-r border-gray-600 pr-2">
            <button
              onClick={() => setTheme('light')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                theme === 'light'
                  ? 'bg-white text-gray-900'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Светлая тема"
            >
              ☀️
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-900 text-gray-100'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Тёмная тема"
            >
              🌙
            </button>
            <button
              onClick={() => setTheme('sepia')}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                theme === 'sepia'
                  ? 'bg-amber-100 text-amber-900'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              title="Сепия"
            >
              📜
            </button>
          </div>

          {/* Font Size Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={decreaseFontSize}
              className="px-2 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              title="Уменьшить шрифт"
              disabled={fontSize <= 75}
            >
              A-
            </button>
            <span className="text-xs text-gray-400 min-w-[3rem] text-center">
              {fontSize}%
            </span>
            <button
              onClick={increaseFontSize}
              className="px-2 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              title="Увеличить шрифт"
              disabled={fontSize >= 200}
            >
              A+
            </button>
          </div>
        </div>
      )}

      {/* Navigation Arrows */}
      <button
        onClick={prevPage}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors z-10"
        aria-label="Previous page"
      >
        ←
      </button>

      <button
        onClick={nextPage}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors z-10"
        aria-label="Next page"
      >
        →
      </button>

      {/* Progress Indicator */}
      <ProgressIndicator
        progress={progress}
        currentChapter={currentChapter}
        theme={theme}
        isVisible={renditionReady && !isLoading && !isGenerating}
      />

      {/* Image Modal */}
      {isModalOpen && selectedImage && (
        <ImageModal
          imageUrl={selectedImage.image_url}
          title={selectedImage.description?.type || 'Generated Image'}
          description={selectedImage.description?.content || ''}
          imageId={selectedImage.id}
          descriptionData={selectedImage.description ? {
            id: selectedImage.description.id,
            type: selectedImage.description.type,
            content: selectedImage.description.content,
            confidence_score: 0,
            priority_score: selectedImage.description.priority_score,
            entities_mentioned: []
          } : undefined}
          isOpen={isModalOpen}
          onClose={closeModal}
          onImageRegenerated={handleImageRegenerated}
        />
      )}
    </div>
  );
};
