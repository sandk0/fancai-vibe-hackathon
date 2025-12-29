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

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
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
  useChapterMapping,
  useDescriptionHighlighting,
  useImageModal,
  useEpubThemes,
  useTouchNavigation,
  useContentHooks,
  useResizeHandler,
  useBookMetadata,
  useTextSelection,
  useToc,
} from '@/hooks/epub';

// Import reading session hook
import { useReadingSession } from '@/hooks/useReadingSession';

// Import components
import { BookInfo } from './BookInfo';
import { SelectionMenu } from './SelectionMenu';
import { TocSidebar } from './TocSidebar';
import { ReaderControls } from './ReaderControls';
import { ReaderHeader } from './ReaderHeader';
import { ImageGenerationStatus } from './ImageGenerationStatus';
import { ExtractionIndicator } from './ExtractionIndicator';
import { ProgressSaveIndicator } from './ProgressSaveIndicator';
import { PositionConflictDialog } from './PositionConflictDialog';
import { notify } from '@/stores/ui';
import { useNavigate } from 'react-router-dom';

// Types for position conflict
interface PositionConflict {
  serverPosition: {
    cfi: string;
    progress: number;
    lastReadAt: Date;
  };
  localPosition: {
    cfi: string;
    progress: number;
    savedAt: Date;
  };
}

interface EpubReaderProps {
  book: BookDetail;
}

/**
 * Convert technical error messages to user-friendly Russian text
 */
function getHumanReadableError(error: string): string {
  const lowerError = error.toLowerCase();

  if (lowerError.includes('network') || lowerError.includes('failed to fetch') || lowerError.includes('net::')) {
    return 'Проверьте подключение к интернету и попробуйте снова.';
  }
  if (lowerError.includes('404') || lowerError.includes('not found')) {
    return 'Файл книги не найден. Возможно, книга была удалена.';
  }
  if (lowerError.includes('401') || lowerError.includes('unauthorized')) {
    return 'Сессия истекла. Пожалуйста, войдите в систему снова.';
  }
  if (lowerError.includes('403') || lowerError.includes('forbidden')) {
    return 'У вас нет доступа к этой книге.';
  }
  if (lowerError.includes('500') || lowerError.includes('internal server')) {
    return 'Ошибка сервера. Попробуйте позже.';
  }
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return 'Превышено время ожидания. Проверьте соединение и попробуйте снова.';
  }
  if (lowerError.includes('epub') || lowerError.includes('parse')) {
    return 'Не удалось открыть файл книги. Формат может быть поврежден.';
  }
  if (lowerError.includes('viewer') || lowerError.includes('container')) {
    return 'Ошибка отображения. Обновите страницу и попробуйте снова.';
  }

  return 'Произошла ошибка при загрузке книги. Попробуйте позже.';
}

export const EpubReader: React.FC<EpubReaderProps> = ({ book }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [renditionReady, setRenditionReady] = useState(false);
  const [isRestoringPosition, setIsRestoringPosition] = useState(true); // Start as true - wait for restoration
  const hasRestoredPosition = useRef(false);
  const previousBookId = useRef<string | null>(null); // Track book changes
  const navigate = useNavigate();

  // State for settings dropdown
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // State for position conflict dialog (sync between devices)
  const [positionConflict, setPositionConflict] = useState<PositionConflict | null>(null);

  // Get auth token
  const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

  // Hook 1: Load EPUB file and create rendition
  const { book: epubBook, rendition, isLoading, error, reload } = useEpubLoader({
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

  // Hook 3: Track CFI position and progress (including page numbers)
  const { currentCFI, progress, scrollOffsetPercent, currentPage, totalPages, goToCFI, skipNextRelocated, setInitialProgress } = useCFITracking({
    rendition,
    locations,
    book: epubBook,
  });

  // Hook 16: Table of Contents (needed early for chapter mapping)
  const { toc, currentHref, setCurrentHref } = useToc(epubBook);

  // Hook 17: Chapter Mapping (maps spine hrefs to backend chapter numbers)
  // FIXED: Solves mismatch between spine index and logical chapter numbers
  const { getChapterNumberByLocation } = useChapterMapping(
    toc,
    book.chapters || []
  );

  // Hook 4: Manage chapter tracking and load descriptions/images
  // FIXED (2025-12-25): Pass isRestoringPosition to prevent race condition
  const { currentChapter, descriptions, images, isExtractingDescriptions, cancelExtraction } = useChapterManagement({
    book: epubBook,
    rendition,
    bookId: book.id,
    getChapterNumberByLocation,
    isRestoringPosition, // Prevent loading during position restoration
  });

  // Hook 5: Debounced progress sync to backend
  const { isSaving, lastSaved } = useProgressSync({
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

  // Hook 7: Image modal management with IndexedDB caching
  const {
    selectedImage,
    isOpen: isModalOpen,
    openModal,
    closeModal,
    updateImage,
    isGenerating: _isGeneratingImage, // Available for future use
    generationStatus,
    generationError,
    descriptionPreview,
    cancelGeneration,
    isCached: _isCached, // For future UI indicator
  } = useImageModal({ bookId: book.id });

  // Hook 8: Keyboard navigation (disabled when modal is open)
  useKeyboardNavigation(nextPage, prevPage, renditionReady && !isModalOpen);

  // Hook 9: Theme management
  const { theme, fontSize, setTheme, increaseFontSize, decreaseFontSize } = useEpubThemes(rendition);

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
  // FIX: Don't gate 'enabled' on descriptions.length > 0
  // This creates a chicken-and-egg problem:
  // 1. descriptions = [] → enabled = false → no listeners set up
  // 2. descriptions load → enabled = true → listeners set up
  // 3. But page is already rendered, and initial handleRendered() might miss it
  // The hook itself handles empty descriptions gracefully (early return in highlightDescriptions)
  useDescriptionHighlighting({
    rendition,
    descriptions,
    images,
    onDescriptionClick: async (desc, img) => {
      await openModal(desc, img);
    },
    enabled: renditionReady, // Always enabled when rendition is ready
  });

  // DEBUG: Log descriptions and highlighting state
  useEffect(() => {
    console.log('📚 [EpubReader] Descriptions state updated:', {
      descriptionsCount: descriptions.length,
      imagesCount: images.length,
      renditionReady,
      highlightingEnabled: renditionReady,
      willHighlight: renditionReady && descriptions.length > 0,
    });
  }, [descriptions, images, renditionReady]);

  // Hook 13: Resize handler for position preservation
  useResizeHandler({
    rendition,
    enabled: renditionReady,
    onResized: (dimensions) => {
      console.log('📐 [EpubReader] Viewport resized:', dimensions);
      // Position is automatically preserved by the hook
    },
  });

  // Hook 14: Book metadata
  const { metadata } = useBookMetadata(epubBook);

  // Hook 15: Text selection (disabled when modal is open)
  const { selection, clearSelection } = useTextSelection(
    rendition,
    renditionReady && !isModalOpen
  );

  // Hook 18: Reading session tracking
  // FIXED: Infinite loop bug caused by useEffect dependencies
  useReadingSession({
    bookId: book.id,
    currentPosition: progress,
    enabled: renditionReady && !isGenerating,
    onSessionStart: (session) => {
      console.log('📖 [EpubReader] Reading session started:', {
        id: session.id,
        book: book.title,
        position: session.start_position.toFixed(2) + '%',
      });
    },
    onSessionEnd: (session) => {
      console.log('📖 [EpubReader] Reading session ended:', {
        id: session.id,
        duration: session.duration_minutes + ' min',
        pages_read: session.pages_read,
      });
      notify.success(
        'Сессия завершена',
        `Вы читали ${session.duration_minutes} мин и прочитали ${session.pages_read} стр.`
      );
    },
    onError: (error) => {
      console.error('❌ [EpubReader] Reading session error:', error);
      // Don't show error notification - sessions are non-critical
    },
  });

  // State for BookInfo modal
  const [isBookInfoOpen, setIsBookInfoOpen] = useState(false);

  // State for TOC sidebar
  const [isTocOpen, setIsTocOpen] = useState(() => {
    // Load TOC state from localStorage
    const saved = localStorage.getItem(`${STORAGE_KEYS.READER_SETTINGS}_toc_open`);
    return saved === 'true';
  });

  // Reset restoration state when book changes
  useEffect(() => {
    if (previousBookId.current !== null && previousBookId.current !== book.id) {
      console.log('📚 [EpubReader] Book changed, resetting restoration state');
      hasRestoredPosition.current = false;
      setIsRestoringPosition(true);
    }
    previousBookId.current = book.id;
  }, [book.id]);

  // Save TOC state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEYS.READER_SETTINGS}_toc_open`, String(isTocOpen));
  }, [isTocOpen]);

  // Clear selection menu when page changes
  useEffect(() => {
    if (currentCFI && selection) {
      console.log('📖 [EpubReader] Page changed, closing selection menu');
      clearSelection();
    }
  }, [currentCFI]); // Only depend on currentCFI, not selection/clearSelection to avoid loops // eslint-disable-line react-hooks/exhaustive-deps

  // Handle TOC chapter navigation
  const handleTocChapterClick = useCallback(async (href: string) => {
    if (!rendition) return;

    try {
      console.log('📚 [EpubReader] Navigating to chapter:', href);
      await rendition.display(href);
      setCurrentHref(href);
    } catch (err) {
      console.error('❌ [EpubReader] Error navigating to chapter:', err);
    }
  }, [rendition, setCurrentHref]);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = useCallback(async () => {
    if (!selection?.text) return;

    try {
      await navigator.clipboard.writeText(selection.text);
      console.log('📋 [EpubReader] Text copied to clipboard:',
        selection.text.substring(0, 50) + (selection.text.length > 50 ? '...' : '')
      );
      notify.success('Скопировано', 'Текст скопирован в буфер обмена');

      // Close selection menu after copy
      clearSelection();
    } catch (err) {
      console.error('❌ [EpubReader] Failed to copy text:', err);
      notify.error('Ошибка', 'Не удалось скопировать текст');
    }
  }, [selection, clearSelection]);

  /**
   * Unified position initialization - either restore saved position or show first page
   * FIXES:
   * - Race condition between displayInitial and restorePosition
   * - Shows loading overlay until position is ready
   * - Proper fallback when CFI is invalid
   * - Sync on Open: Checks localStorage backup vs server position for multi-device sync
   */
  useEffect(() => {
    if (!rendition || !renditionReady) return;

    // Skip if already restored position for this book
    if (hasRestoredPosition.current) {
      console.log('[EpubReader] Position already restored, skipping');
      setIsRestoringPosition(false);
      return;
    }

    let isMounted = true;

    const initializePosition = async () => {
      setIsRestoringPosition(true);

      try {
        // Fetch saved progress from server
        console.log('[EpubReader] Fetching saved progress...');
        const { progress: savedProgress } = await booksAPI.getReadingProgress(book.id);

        if (!isMounted) return;

        // Check localStorage backup for position conflict (multi-device sync)
        const localBackupKey = `book_${book.id}_progress_backup`;
        const localBackupRaw = localStorage.getItem(localBackupKey);

        if (localBackupRaw && savedProgress) {
          try {
            const localBackup = JSON.parse(localBackupRaw);
            const serverPercent = savedProgress.current_position || 0;
            const localPercent = localBackup.current_position || 0;

            console.log('[EpubReader] Comparing positions:', {
              server: serverPercent.toFixed(2) + '%',
              local: localPercent.toFixed(2) + '%',
              difference: Math.abs(serverPercent - localPercent).toFixed(2) + '%',
            });

            // If difference > 5% - show conflict dialog
            if (Math.abs(serverPercent - localPercent) > 5) {
              console.log('[EpubReader] Position conflict detected (>5% difference)');

              setPositionConflict({
                serverPosition: {
                  cfi: savedProgress.reading_location_cfi || '',
                  progress: serverPercent,
                  lastReadAt: new Date(savedProgress.last_read_at),
                },
                localPosition: {
                  cfi: localBackup.reading_location_cfi || '',
                  progress: localPercent,
                  savedAt: new Date(localBackup.savedAt || Date.now()),
                },
              });

              // Show first page while waiting for user decision
              // Don't set isRestoringPosition to false yet - user must choose
              await rendition.display();
              return; // Wait for user to choose position
            }
          } catch (parseError) {
            console.warn('[EpubReader] Failed to parse local backup, ignoring:', parseError);
            // Continue with server position
          }
        }

        // No conflict or no local backup - use server position
        if (savedProgress?.reading_location_cfi) {
          // Try to restore saved position
          console.log('[EpubReader] Restoring saved position:', {
            cfi: savedProgress.reading_location_cfi.substring(0, 80) + '...',
            progress: savedProgress.current_position + '%',
            scrollOffset: savedProgress.scroll_offset_percent || 0,
          });

          try {
            skipNextRelocated(); // Skip auto-save on restored position
            await goToCFI(savedProgress.reading_location_cfi, savedProgress.scroll_offset_percent || 0);

            // Set initial progress immediately so header shows correct value
            setInitialProgress(savedProgress.reading_location_cfi, savedProgress.current_position);

            console.log('[EpubReader] Position restoration complete');
          } catch (cfiError) {
            // CFI is invalid - fallback to percentage or first page
            console.warn('[EpubReader] CFI invalid, trying percentage fallback:', cfiError);

            if (savedProgress.current_position > 0 && locations) {
              // Try to restore by percentage
              try {
                const fallbackCfi = locations.cfiFromPercentage(savedProgress.current_position / 100);
                if (fallbackCfi) {
                  await rendition.display(fallbackCfi);
                  setInitialProgress(fallbackCfi, savedProgress.current_position);
                  console.log('[EpubReader] Restored position via percentage fallback');
                } else {
                  throw new Error('Could not generate CFI from percentage');
                }
              } catch (fallbackError) {
                console.error('[EpubReader] Percentage fallback failed, showing first page:', fallbackError);
                await rendition.display();
              }
            } else {
              // No percentage or locations - show first page
              await rendition.display();
            }
          }
        } else {
          // No saved progress - show first page
          console.log('[EpubReader] No saved progress, displaying first page');
          await rendition.display();
        }

        // Mark as restored
        hasRestoredPosition.current = true;
      } catch (err) {
        console.error('[EpubReader] Error initializing position:', err);
        // On any error, try to show first page
        try {
          await rendition.display();
        } catch (displayErr) {
          console.error('[EpubReader] Could not even display first page:', displayErr);
        }
      } finally {
        if (isMounted && !positionConflict) {
          setIsRestoringPosition(false);
        }
      }
    };

    initializePosition();

    return () => {
      isMounted = false;
    };
  }, [rendition, renditionReady, book.id, locations, goToCFI, skipNextRelocated, setInitialProgress, positionConflict]);

  /**
   * Handle image regeneration
   */
  const handleImageRegenerated = useCallback((newImageUrl: string) => {
    updateImage(newImageUrl);
  }, [updateImage]);

  /**
   * Handle position conflict resolution - use server position
   */
  const handleUseServerPosition = useCallback(async () => {
    if (!rendition || !positionConflict) return;

    try {
      console.log('[EpubReader] User chose server position:', positionConflict.serverPosition.progress + '%');

      skipNextRelocated(); // Skip auto-save on restored position

      if (positionConflict.serverPosition.cfi) {
        await goToCFI(positionConflict.serverPosition.cfi);
        setInitialProgress(positionConflict.serverPosition.cfi, positionConflict.serverPosition.progress);
      } else if (locations && positionConflict.serverPosition.progress > 0) {
        // Fallback to percentage if no CFI
        const fallbackCfi = locations.cfiFromPercentage(positionConflict.serverPosition.progress / 100);
        if (fallbackCfi) {
          await rendition.display(fallbackCfi);
          setInitialProgress(fallbackCfi, positionConflict.serverPosition.progress);
        }
      }

      // Update local backup to match server
      const localBackupKey = `book_${book.id}_progress_backup`;
      localStorage.setItem(localBackupKey, JSON.stringify({
        reading_location_cfi: positionConflict.serverPosition.cfi,
        current_position: positionConflict.serverPosition.progress,
        savedAt: Date.now(),
      }));

      hasRestoredPosition.current = true;
      setPositionConflict(null);
      setIsRestoringPosition(false);

      notify.success('Позиция восстановлена', `Продолжаем с ${Math.round(positionConflict.serverPosition.progress)}%`);
    } catch (err) {
      console.error('[EpubReader] Error navigating to server position:', err);
      notify.error('Ошибка', 'Не удалось перейти к сохраненной позиции');
      setPositionConflict(null);
      setIsRestoringPosition(false);
    }
  }, [rendition, positionConflict, goToCFI, skipNextRelocated, setInitialProgress, locations, book.id]);

  /**
   * Handle position conflict resolution - use local position
   */
  const handleUseLocalPosition = useCallback(async () => {
    if (!rendition || !positionConflict) return;

    try {
      console.log('[EpubReader] User chose local position:', positionConflict.localPosition.progress + '%');

      skipNextRelocated(); // Skip auto-save on restored position

      if (positionConflict.localPosition.cfi) {
        await goToCFI(positionConflict.localPosition.cfi);
        setInitialProgress(positionConflict.localPosition.cfi, positionConflict.localPosition.progress);
      } else if (locations && positionConflict.localPosition.progress > 0) {
        // Fallback to percentage if no CFI
        const fallbackCfi = locations.cfiFromPercentage(positionConflict.localPosition.progress / 100);
        if (fallbackCfi) {
          await rendition.display(fallbackCfi);
          setInitialProgress(fallbackCfi, positionConflict.localPosition.progress);
        }
      }

      hasRestoredPosition.current = true;
      setPositionConflict(null);
      setIsRestoringPosition(false);

      notify.success('Позиция восстановлена', `Продолжаем с ${Math.round(positionConflict.localPosition.progress)}%`);
    } catch (err) {
      console.error('[EpubReader] Error navigating to local position:', err);
      notify.error('Ошибка', 'Не удалось перейти к локальной позиции');
      setPositionConflict(null);
      setIsRestoringPosition(false);
    }
  }, [rendition, positionConflict, goToCFI, skipNextRelocated, setInitialProgress, locations]);

  // Get background color based on theme - memoized to prevent recalculation
  const backgroundColor = useMemo(() => {
    switch (theme) {
      case 'light':
        return 'bg-white';
      case 'sepia':
        return 'bg-amber-50';
      case 'dark':
      default:
        return 'bg-gray-900';
    }
  }, [theme]);

  // Ref to prevent double-firing on touch devices (touchend + click)
  const lastTapTimeRef = useRef<number>(0);

  // Handle tap zones for mobile navigation with debounce
  const handleTapZone = useCallback((zone: 'left' | 'right', isTouch: boolean = false) => {
    if (!renditionReady || isModalOpen || isTocOpen || isSettingsOpen || isBookInfoOpen || positionConflict) return;

    const now = Date.now();
    // Debounce: ignore if less than 300ms since last tap
    if (now - lastTapTimeRef.current < 300) {
      console.log('[EpubReader] Tap debounced - too fast');
      return;
    }
    lastTapTimeRef.current = now;

    if (zone === 'left') {
      console.log(`[EpubReader] Left tap zone ${isTouch ? 'touched' : 'clicked'}, going to previous page`);
      prevPage();
    } else {
      console.log(`[EpubReader] Right tap zone ${isTouch ? 'touched' : 'clicked'}, going to next page`);
      nextPage();
    }
  }, [renditionReady, isModalOpen, isTocOpen, isSettingsOpen, isBookInfoOpen, positionConflict, prevPage, nextPage]);

  // Main render - viewerRef MUST stay in same DOM location to prevent rendition destruction
  return (
    <div className={`relative h-full w-full transition-colors ${backgroundColor}`}>
      {/* EPUB Viewer - Maximum reading space, with safe-area support */}
      <div
        ref={viewerRef}
        className={`h-full w-full ${backgroundColor}`}
        style={{
          paddingTop: 'calc(70px + env(safe-area-inset-top))', // Header + notch
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      />

      {/* Mobile Tap Zones - invisible touch areas for page navigation */}
      {renditionReady && !isLoading && !isGenerating && !isRestoringPosition && (
        <>
          {/* Left tap zone - previous page */}
          <div
            className="fixed left-0 bottom-0 w-[25%] z-[5] md:hidden active:bg-black/5"
            style={{
              background: 'transparent',
              pointerEvents: 'auto',
              top: 'calc(70px + env(safe-area-inset-top))',
              paddingBottom: 'env(safe-area-inset-bottom)',
              WebkitTapHighlightColor: 'transparent',
            }}
            onClick={() => handleTapZone('left', false)}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTapZone('left', true);
            }}
            aria-label="Previous page"
            role="button"
          />
          {/* Right tap zone - next page */}
          <div
            className="fixed right-0 bottom-0 w-[25%] z-[5] md:hidden active:bg-black/5"
            style={{
              background: 'transparent',
              pointerEvents: 'auto',
              top: 'calc(70px + env(safe-area-inset-top))',
              paddingBottom: 'env(safe-area-inset-bottom)',
              WebkitTapHighlightColor: 'transparent',
            }}
            onClick={() => handleTapZone('right', false)}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleTapZone('right', true);
            }}
            aria-label="Next page"
            role="button"
          />
        </>
      )}

      {/* Loading Overlay */}
      {(isLoading || isGenerating || isRestoringPosition) && (
        <div className={`absolute inset-0 flex items-center justify-center ${backgroundColor} z-10`} data-testid="loading-overlay">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className={theme === 'light' ? 'text-gray-700' : 'text-gray-300'} data-testid="loading-text">
              {isRestoringPosition ? 'Восстановление позиции...' : isGenerating ? 'Подготовка книги...' : 'Загрузка книги...'}
            </p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className={`absolute inset-0 flex items-center justify-center ${backgroundColor} z-10`}>
          <div className="text-center max-w-md mx-4">
            {/* Error Icon */}
            <div className="mb-6">
              <svg
                className="w-16 h-16 mx-auto text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            {/* Error Title */}
            <h3 className={`text-xl font-semibold mb-3 ${theme === 'light' ? 'text-gray-800' : 'text-gray-100'}`}>
              Не удалось загрузить книгу
            </h3>

            {/* Human-readable Error Message */}
            <p className={`mb-6 ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
              {getHumanReadableError(error)}
            </p>

            {/* Technical Error (collapsed by default, for debugging) */}
            <details className={`mb-6 text-left ${theme === 'light' ? 'text-gray-500' : 'text-gray-500'}`}>
              <summary className="cursor-pointer text-sm hover:text-blue-500 transition-colors">
                Техническая информация
              </summary>
              <pre className={`mt-2 p-3 rounded text-xs overflow-x-auto ${theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'}`}>
                {error}
              </pre>
            </details>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={reload}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Попробовать снова
              </button>
              <button
                onClick={() => navigate('/library')}
                className={`px-6 py-2.5 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
                  ${theme === 'light'
                    ? 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200 focus:ring-gray-500'
                  }`}
              >
                В библиотеку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Reader Header - Theme-aware with all controls and progress */}
      {renditionReady && !isLoading && !isGenerating && !isRestoringPosition && metadata && (
        <ReaderHeader
          title={metadata.title}
          author={metadata.creator}
          theme={theme}
          progress={progress}
          currentPage={currentPage ?? undefined}
          totalPages={totalPages ?? undefined}
          onBack={() => navigate(`/book/${book.id}`)}
          onTocToggle={() => setIsTocOpen(!isTocOpen)}
          onInfoOpen={() => setIsBookInfoOpen(true)}
          onSettingsOpen={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Settings Dropdown (hidden, triggered by header button) */}
      {renditionReady && !isLoading && !isGenerating && !isRestoringPosition && (
        <div className="fixed top-16 right-4 z-50">
          <ReaderControls
            theme={theme}
            fontSize={fontSize}
            onThemeChange={setTheme}
            onFontSizeIncrease={increaseFontSize}
            onFontSizeDecrease={decreaseFontSize}
            isOpen={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
          />
        </div>
      )}

      {/* Description Extraction Indicator - Prominent floating card */}
      <ExtractionIndicator
        isExtracting={isExtractingDescriptions}
        onCancel={cancelExtraction}
        theme={theme}
      />

      {/* Image Generation Status */}
      <ImageGenerationStatus
        status={generationStatus}
        descriptionPreview={descriptionPreview}
        error={generationError}
        theme={theme}
        onCancel={cancelGeneration}
      />

      {/* Progress Save Indicator */}
      <ProgressSaveIndicator
        lastSaved={lastSaved}
        isSaving={isSaving}
      />

      {/* Position Conflict Dialog - Multi-device sync */}
      {positionConflict && (
        <PositionConflictDialog
          serverPosition={positionConflict.serverPosition}
          localPosition={positionConflict.localPosition}
          onUseServer={handleUseServerPosition}
          onUseLocal={handleUseLocalPosition}
        />
      )}

      {/* Image Modal */}
      {isModalOpen && selectedImage && (
        <ImageModal
          imageUrl={selectedImage.image_url}
          title={selectedImage.description?.type || 'Generated Image'}
          description={selectedImage.description?.text || selectedImage.description?.content || ''}
          imageId={selectedImage.id}
          descriptionData={selectedImage.description ? {
            id: selectedImage.description.id,
            type: selectedImage.description.type,
            content: selectedImage.description.text || selectedImage.description.content,
            confidence_score: 0,
            priority_score: selectedImage.description.priority_score,
            entities_mentioned: []
          } : undefined}
          isOpen={isModalOpen}
          onClose={closeModal}
          onImageRegenerated={handleImageRegenerated}
        />
      )}


      {/* Book Info Modal */}
      {isBookInfoOpen && metadata && (
        <BookInfo
          metadata={metadata}
          isOpen={isBookInfoOpen}
          onClose={() => setIsBookInfoOpen(false)}
          theme={theme}
        />
      )}

      {/* Selection Menu */}
      <SelectionMenu
        selection={selection}
        onCopy={handleCopy}
        onClose={clearSelection}
        theme={theme}
      />

      {/* TOC Sidebar */}
      <TocSidebar
        toc={toc}
        currentHref={currentHref}
        onChapterClick={handleTocChapterClick}
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
        theme={theme}
      />

    </div>
  );
};
