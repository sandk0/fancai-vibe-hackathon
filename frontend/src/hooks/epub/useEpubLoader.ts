/**
 * useEpubLoader - Custom hook for loading and initializing EPUB books
 *
 * Handles the complete lifecycle of loading an EPUB file:
 * - Downloads the book file with authorization
 * - Initializes epub.js Book and Rendition instances
 * - Applies theme styles
 * - Cleanup on unmount to prevent memory leaks
 *
 * @param bookUrl - URL to the EPUB file
 * @param viewerRef - React ref to the container element for rendering
 * @param authToken - Authentication token for authorized downloads
 * @returns Book and Rendition instances, loading state, and error state
 *
 * @example
 * const { book, rendition, isLoading, error } = useEpubLoader(
 *   booksAPI.getBookFileUrl(bookId),
 *   viewerRef,
 *   localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
 * );
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import ePub from 'epubjs';
import type { Book, Rendition } from '@/types/epub';

interface UseEpubLoaderOptions {
  bookUrl: string;
  viewerRef: React.RefObject<HTMLDivElement>;
  authToken: string | null;
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
    console.log('🔄 [useEpubLoader] Reloading book...');
    setError('');
    setReloadKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!viewerRef.current) {
      console.error('❌ [useEpubLoader] Viewer ref is null');
      setError('Viewer container not found');
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    const loadEpub = async () => {
      try {
        console.log('📥 [useEpubLoader] Downloading EPUB file...');
        setIsLoading(true);
        setError('');

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

        const arrayBuffer = await response.arrayBuffer();
        console.log('✅ [useEpubLoader] EPUB file downloaded', {
          size: arrayBuffer.byteLength
        });

        if (!isMounted) return;

        // Initialize epub.js with ArrayBuffer
        const epubBook = ePub(arrayBuffer) as unknown as Book;
        bookRef.current = epubBook;
        setBook(epubBook);

        // Wait for book to be ready
        console.log('⏳ [useEpubLoader] Waiting for book to load...');
        await epubBook.ready;
        console.log('✅ [useEpubLoader] Book ready');

        if (!isMounted || !viewerRef.current) return;

        // Create rendition using renderTo (this is the epubjs API method)
        const newRendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
        });
        renditionRef.current = newRendition;
        setRendition(newRendition);

        // Note: Theme is now applied by useEpubThemes hook
        console.log('✅ [useEpubLoader] EPUB loaded successfully');
        setIsLoading(false);

        if (onReady) {
          onReady();
        }

      } catch (err) {
        // Don't show error if request was aborted (component unmounted)
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('ℹ️ [useEpubLoader] Request aborted (component unmounted)');
          return;
        }

        console.error('❌ [useEpubLoader] Error loading EPUB:', err);
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
      console.log('🧹 [useEpubLoader] Cleaning up...');

      // Cleanup rendition first
      if (renditionRef.current) {
        try {
          const currentRendition = renditionRef.current;

          // Clear all event listeners
          // Note: rendition.off() without arguments clears all listeners
          try {
            currentRendition.off();
          } catch (err) {
            // Ignore event listener errors
            console.debug('⚠️ [useEpubLoader] Could not remove event listeners:', err);
          }

          // Safely destroy rendition
          if (typeof currentRendition.destroy === 'function') {
            currentRendition.destroy();
            console.log('✅ [useEpubLoader] Rendition destroyed');
          }

          renditionRef.current = null;
        } catch (err) {
          console.warn('⚠️ [useEpubLoader] Error destroying rendition:', err);
        }
      }

      // Cleanup book instance
      if (bookRef.current) {
        try {
          const currentBook = bookRef.current;

          // Safely destroy book
          if (typeof currentBook.destroy === 'function') {
            currentBook.destroy();
            console.log('✅ [useEpubLoader] Book destroyed');
          }

          bookRef.current = null;
        } catch (err) {
          console.warn('⚠️ [useEpubLoader] Error destroying book:', err);
        }
      }

      // Clear state
      setBook(null);
      setRendition(null);
    };
  }, [bookUrl, authToken, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    book,
    rendition,
    isLoading,
    error,
    reload,
  };
};
