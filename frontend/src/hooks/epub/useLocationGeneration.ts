/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useLocationGeneration - Custom hook for generating and caching EPUB locations
 *
 * EPUB.js locations are used for progress tracking and CFI calculations.
 * This hook implements IndexedDB caching to avoid regenerating locations
 * on every page load (which can take 5-10 seconds for large books).
 *
 * Performance improvement: 5-10s → <100ms on subsequent loads
 *
 * @param book - epub.js Book instance
 * @param bookId - Unique identifier for caching
 * @returns Locations instance and loading state
 *
 * @example
 * const { locations, isGenerating } = useLocationGeneration(book, bookId);
 * if (locations) {
 *   const percent = locations.percentageFromCfi(cfi);
 * }
 */

import { useState, useEffect } from 'react';
import type { Book, EpubLocations } from '@/types/epub';

interface UseLocationGenerationReturn {
  locations: EpubLocations | null;
  isGenerating: boolean;
  error: string | null;
}

const DB_NAME = 'BookReaderAI';
const DB_VERSION = 1;
const STORE_NAME = 'epub_locations';

// IndexedDB utilities
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
      }
    };
  });
};

const getCachedLocations = async (bookId: string): Promise<any | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.locations : null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('⚠️ [useLocationGeneration] IndexedDB not available:', err);
    return null;
  }
};

const cacheLocations = async (bookId: string, locations: any): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        bookId,
        locations,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('⚠️ [useLocationGeneration] Could not cache locations:', err);
  }
};

export const useLocationGeneration = (
  book: Book | null,
  bookId: string
): UseLocationGenerationReturn => {
  const [locations, setLocations] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!book) return;

    let isMounted = true;

    const generateOrLoadLocations = async () => {
      try {
        setIsGenerating(true);
        setError(null);

        // Ensure book is ready and spine is loaded
        await book.ready;

        // Check if spine exists and is ready
        const spine = (book as any).spine;
        if (!spine || !spine.items || spine.items.length === 0) {
          console.warn('⚠️ [useLocationGeneration] Spine not ready yet, waiting...');
          // Wait a bit more for spine to load
          await new Promise(resolve => setTimeout(resolve, 500));

          // Check again
          if (!spine || !spine.items || spine.items.length === 0) {
            throw new Error('Book spine is not available');
          }
        }

        console.log('✅ [useLocationGeneration] Book spine ready with', spine.items.length, 'items');

        // Try to load from cache first
        console.log('📊 [useLocationGeneration] Checking cache for book:', bookId);
        const cachedLocations = await getCachedLocations(bookId);

        if (cachedLocations && isMounted) {
          console.log('✅ [useLocationGeneration] Loaded locations from cache');

          // Load cached locations into book.locations
          book.locations.load(cachedLocations);
          setLocations(book.locations);
          setIsGenerating(false);
          return;
        }

        // Generate locations if not cached
        console.log('📊 [useLocationGeneration] Generating locations (this may take a few seconds)...');
        await book.locations.generate(1600); // 1600 characters per "page"

        if (!isMounted) return;

        const total = (book.locations as any).total || 0;
        console.log('✅ [useLocationGeneration] Locations generated:', total);

        // Cache the generated locations
        const locationsData = book.locations.save();
        await cacheLocations(bookId, locationsData);
        console.log('💾 [useLocationGeneration] Locations cached');

        setLocations(book.locations);
        setIsGenerating(false);

      } catch (err) {
        console.error('❌ [useLocationGeneration] Error generating locations:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to generate locations');
          setIsGenerating(false);
        }
      }
    };

    generateOrLoadLocations();

    return () => {
      isMounted = false;
    };
  }, [book, bookId]);

  return {
    locations,
    isGenerating,
    error,
  };
};

/**
 * Utility function to clear cached locations for a book
 * Useful when book content has changed
 */
export const clearCachedLocations = async (bookId: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(bookId);

      request.onsuccess = () => {
        console.log('✅ [clearCachedLocations] Cache cleared for book:', bookId);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('⚠️ [clearCachedLocations] Could not clear cache:', err);
  }
};
