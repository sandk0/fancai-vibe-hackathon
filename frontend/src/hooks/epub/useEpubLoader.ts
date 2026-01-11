/**
 * useEpubLoader - Custom hook for loading and initializing EPUB books
 *
 * Handles the complete lifecycle of loading an EPUB file:
 * - Checks IndexedDB cache for offline EPUB data first
 * - Downloads the book file with authorization if not cached
 * - Initializes epub.js Book and Rendition instances
 * - Applies theme styles
 * - Cleanup on unmount to prevent memory leaks
 *
 * @param bookUrl - URL to the EPUB file
 * @param viewerRef - React ref to the container element for rendering
 * @param authToken - Authentication token for authorized downloads
 * @param bookId - Book ID for cache lookup (optional)
 * @param userId - User ID for cache lookup (optional)
 * @returns Book and Rendition instances, loading state, and error state
 *
 * @example
 * const { book, rendition, isLoading, error } = useEpubLoader({
 *   bookUrl: booksAPI.getBookFileUrl(bookId),
 *   viewerRef,
 *   authToken: localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN),
 *   bookId,
 *   userId: user?.id,
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import ePub from 'epubjs';
import type { Book, Rendition } from '@/types/epub';
import { epubCache } from '@/services/epubCache';
import { isOnline } from '@/hooks/useOnlineStatus';

/** Enable debug logging only in development */
const DEBUG = import.meta.env.DEV;

interface UseEpubLoaderOptions {
  bookUrl: string;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  authToken: string | null;
  /** Book ID for cache lookup */
  bookId?: string;
  /** User ID for cache lookup */
  userId?: string;
  onReady?: () => void;
}

interface UseEpubLoaderReturn {
  book: Book | null;
  rendition: Rendition | null;
  isLoading: boolean;
  error: string;
  reload: () => void;
}

export const useEpubLoader = ({
  bookUrl,
  viewerRef,
  authToken,
  bookId,
  userId,
  onReady,
}: UseEpubLoaderOptions): UseEpubLoaderReturn => {
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);

  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | null>(null);

  // Reload function to retry loading the book
  const reload = useCallback(() => {
    setError('');
    setReloadKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!viewerRef.current) {
      setError('Viewer container not found');
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    const loadEpub = async () => {
      try {
        setIsLoading(true);
        setError('');

        let arrayBuffer: ArrayBuffer | null = null;

        // 1. Try to load from IndexedDB cache first
        if (bookId && userId) {
          if (DEBUG) console.log('[useEpubLoader] Checking cache for book:', bookId);
          arrayBuffer = await epubCache.get(userId, bookId);

          if (arrayBuffer) {
            if (DEBUG) console.log('[useEpubLoader] Using cached EPUB for:', bookId);
          }
        }

        // 2. If not cached, try to fetch from network
        if (!arrayBuffer) {
          // Check if we're offline
          if (!isOnline()) {
            throw new Error('Книга недоступна офлайн. Скачайте её для офлайн-чтения.');
          }

          if (DEBUG) console.log('[useEpubLoader] Fetching EPUB from network:', bookUrl);

          // Download EPUB file with authorization and abort signal
          const response = await fetch(bookUrl, {
            headers: authToken ? {
              'Authorization': `Bearer ${authToken}`,
            } : {},
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error(`Failed to download EPUB: ${response.statusText}`);
          }

          arrayBuffer = await response.arrayBuffer();
        }

        if (!isMounted) return;

        // Initialize epub.js with ArrayBuffer
        const epubBook = ePub(arrayBuffer) as unknown as Book;
        bookRef.current = epubBook;
        setBook(epubBook);

        // Wait for book to be ready
        await epubBook.ready;

        if (!isMounted || !viewerRef.current) return;

        // Create rendition using renderTo (this is the epubjs API method)
        // Note: We use capture phase handlers in useTouchNavigation to intercept
        // touch/click events before epub.js processes them
        //
        // iOS Safari Fix (January 2026):
        // - minSpreadWidth: 99999 forces single-column layout on all screen sizes
        // - This prevents iOS Safari from miscalculating CSS column widths
        // - Without this, iOS can render 2 columns when only 1 should be shown,
        //   causing "double page turn" visual bug
        const newRendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          minSpreadWidth: 99999, // Force single-column on iOS
          flow: 'paginated', // Ensure paginated mode
        });

        // Apply initial theme immediately BEFORE rendering content
        // This prevents flash of light-themed content
        const savedTheme = localStorage.getItem('app-theme') || 'dark';
        const INITIAL_THEMES: Record<string, Record<string, Record<string, string>>> = {
          light: { body: { color: '#1A1A1A', background: '#FFFFFF' } },
          dark: { body: { color: '#E8E8E8', background: '#121212' } },
          sepia: { body: { color: '#3D2914', background: '#FBF0D9' } },
          night: { body: { color: '#B0B0B0', background: '#000000' } },
        };
        const themeStyles = INITIAL_THEMES[savedTheme] || INITIAL_THEMES.dark;
        newRendition.themes.default(themeStyles);

        renditionRef.current = newRendition;
        setRendition(newRendition);

        // iOS-ONLY FIX: Force single-page spread AFTER book metadata is loaded
        // Book metadata can override our initial spread:'none' setting
        // This explicit call ensures our setting takes precedence on iOS
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIOSDevice) {
          newRendition.spread('none', 99999);

          // iOS FIX: Listen for layout event and force single-column BEFORE rendering
          // This ensures epub.js calculates navigation based on single column
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          newRendition.on('layout', (layout: any) => {
            if (layout && layout.divisor !== 1) {
              console.warn('[useEpubLoader] iOS layout event: Fixing divisor from', layout.divisor, 'to 1');
              layout.divisor = 1;
              layout._spread = 'none';
            }
          });

          if (DEBUG) {
            console.log('[useEpubLoader] iOS: Applied spread("none", 99999) and layout fix');
          }
        }

        // Debug logging (dev only)
        if (DEBUG) {
          console.log('[useEpubLoader] Rendition created:', {
            isIOS: isIOSDevice,
            spread: newRendition.settings?.spread,
            minSpreadWidth: newRendition.settings?.minSpreadWidth,
          });
        }

        // Disable horizontal swipe/touch navigation in iframe to prevent multiple page turns
        newRendition.on('rendered', () => {
          const iframe = viewerRef.current?.querySelector('iframe');
          if (iframe?.contentDocument?.body) {
            // Disable horizontal swipe, allow only vertical scroll
            iframe.contentDocument.body.style.touchAction = 'pan-y';
            iframe.contentDocument.body.style.overscrollBehaviorX = 'none';
            // Enable text selection
            iframe.contentDocument.body.style.userSelect = 'text';
            iframe.contentDocument.body.style.webkitUserSelect = 'text';
          }

          // iOS FIX: Force divisor=1 to prevent multiple page turns
          // epub.js may calculate wrong divisor based on container width
          if (isIOSDevice && newRendition.manager?.layout) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const layout = newRendition.manager.layout as any;
            if (layout.divisor !== 1) {
              console.warn('[useEpubLoader] iOS: Fixing divisor from', layout.divisor, 'to 1');
              layout.divisor = 1;
              layout._spread = 'none';
            }
          }

          // DEBUG: Log layout after each render
          if (DEBUG && newRendition.manager?.layout) {
            console.log('[useEpubLoader] Layout after render:', {
              divisor: newRendition.manager.layout.divisor,
              columnWidth: newRendition.manager.layout.columnWidth,
              _spread: newRendition.manager.layout._spread,
            });
          }
        });

        // Note: Initial theme applied above, useEpubThemes hook handles theme changes
        setIsLoading(false);

        if (onReady) {
          onReady();
        }

      } catch (err) {
        // Don't show error if request was aborted (component unmounted)
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('[useEpubLoader] Error loading EPUB:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error loading book');
          setIsLoading(false);
        }
      }
    };

    loadEpub();

    // Cleanup function
    return () => {
      isMounted = false;
      // Abort any pending fetch requests
      abortController.abort();

      // Cleanup rendition first
      if (renditionRef.current) {
        try {
          const currentRendition = renditionRef.current;

          // Clear all event listeners
          // Note: rendition.off() without arguments clears all listeners
          try {
            currentRendition.off();
          } catch (_err) {
            // Ignore event listener errors
          }

          // Safely destroy rendition
          if (typeof currentRendition.destroy === 'function') {
            currentRendition.destroy();
          }

          renditionRef.current = null;
        } catch (_err) {
          // Ignore destruction errors during cleanup
        }
      }

      // Cleanup book instance
      if (bookRef.current) {
        try {
          const currentBook = bookRef.current;

          // Safely destroy book
          if (typeof currentBook.destroy === 'function') {
            currentBook.destroy();
          }

          bookRef.current = null;
        } catch (_err) {
          // Ignore destruction errors during cleanup
        }
      }

      // Clear state
      setBook(null);
      setRendition(null);
    };
  }, [bookUrl, authToken, bookId, userId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    book,
    rendition,
    isLoading,
    error,
    reload,
  };
};
