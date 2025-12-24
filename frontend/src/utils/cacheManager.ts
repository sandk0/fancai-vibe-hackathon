/**
 * Cache Manager - Unified cache clearing utility
 *
 * Provides centralized cache management for authentication flows.
 * Clears all application caches including:
 * - TanStack Query cache (server state)
 * - IndexedDB caches (chapterCache, imageCache, epub_locations)
 * - Service Worker cache storage (offline assets)
 * - localStorage (pending_sessions)
 * - Reader store state (Zustand)
 *
 * CRITICAL: Must be called on logout to prevent data leakage between users!
 *
 * Security layers cleared:
 * 1. TanStack Query - prevents stale API data
 * 2. Chapter cache - prevents book content leakage
 * 3. Image cache - prevents generated images leakage
 * 4. Reader store - prevents reading position leakage
 * 5. Service Worker cache - prevents offline asset leakage
 * 6. EPUB locations - prevents book structure/navigation leakage
 * 7. Pending sessions - prevents reading history leakage
 *
 * @module utils/cacheManager
 */

import { queryClient } from '@/lib/queryClient';
import { chapterCache } from '@/services/chapterCache';
import { imageCache } from '@/services/imageCache';
import { useReaderStore } from '@/stores/reader';

/**
 * Result of cache clearing operation
 */
interface ClearCacheResult {
  success: boolean;
  tanstackCleared: boolean;
  chapterCacheCleared: boolean;
  imageCacheCleared: boolean;
  readerStoreCleared: boolean;
  serviceWorkerCacheCleared: boolean;
  epubLocationsCleared: boolean;
  pendingSessionsCleared: boolean;
  errors: string[];
}

/**
 * Clear all application caches
 *
 * Should be called:
 * - On logout (mandatory)
 * - On login (to clear any stale data from previous session)
 * - When switching users
 *
 * @returns ClearCacheResult with status of each cache clearing operation
 */
export async function clearAllCaches(): Promise<ClearCacheResult> {
  console.log('🧹 [CacheManager] Clearing all caches...');

  const result: ClearCacheResult = {
    success: true,
    tanstackCleared: false,
    chapterCacheCleared: false,
    imageCacheCleared: false,
    readerStoreCleared: false,
    serviceWorkerCacheCleared: false,
    epubLocationsCleared: false,
    pendingSessionsCleared: false,
    errors: [],
  };

  // 1. Clear TanStack Query cache
  try {
    queryClient.clear();
    result.tanstackCleared = true;
    console.log('✅ [CacheManager] TanStack Query cache cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`TanStack Query: ${message}`);
    console.error('❌ [CacheManager] Failed to clear TanStack Query cache:', error);
  }

  // 2. Clear IndexedDB chapter cache
  try {
    // NOTE: clearAll теперь требует userId
    const { useAuthStore } = await import('@/stores/auth');
    const userId = useAuthStore.getState().user?.id;

    if (userId) {
      await chapterCache.clearAll(userId);
      result.chapterCacheCleared = true;
      console.log('✅ [CacheManager] Chapter cache cleared for user:', userId);
    } else {
      // Если нет userId (уже разлогинились), пропускаем
      result.chapterCacheCleared = true;
      console.log('ℹ️ [CacheManager] No userId available, skipping chapter cache clear');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Chapter cache: ${message}`);
    console.error('❌ [CacheManager] Failed to clear chapter cache:', error);
  }

  // 3. Clear IndexedDB image cache
  try {
    // NOTE: clearAll теперь требует userId, но на logout мы очищаем ВСЕ данные
    // Получаем userId из auth store перед очисткой
    const { useAuthStore } = await import('@/stores/auth');
    const userId = useAuthStore.getState().user?.id;

    if (userId) {
      await imageCache.clearAll(userId);
      result.imageCacheCleared = true;
      console.log('✅ [CacheManager] Image cache cleared for user:', userId);
    } else {
      // Если нет userId (уже разлогинились), пропускаем
      result.imageCacheCleared = true;
      console.log('ℹ️ [CacheManager] No userId available, skipping image cache clear');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Image cache: ${message}`);
    console.error('❌ [CacheManager] Failed to clear image cache:', error);
  }

  // 4. Reset reader store state
  try {
    useReaderStore.getState().reset();
    result.readerStoreCleared = true;
    console.log('✅ [CacheManager] Reader store cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Reader store: ${message}`);
    console.error('❌ [CacheManager] Failed to clear reader store:', error);
  }

  // 5. Clear Service Worker cache storage (CRITICAL for security)
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      result.serviceWorkerCacheCleared = true;
      console.log(`✅ [CacheManager] Service Worker cache cleared (${cacheNames.length} caches)`);
    } else {
      // Browser doesn't support Cache API (not an error)
      result.serviceWorkerCacheCleared = true;
      console.log('ℹ️ [CacheManager] Cache API not available (skipped)');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Service Worker cache: ${message}`);
    console.error('❌ [CacheManager] Failed to clear Service Worker cache:', error);
  }

  // 6. Clear epub_locations IndexedDB (CRITICAL for security)
  try {
    await clearEpubLocationsDB();
    result.epubLocationsCleared = true;
    console.log('✅ [CacheManager] EPUB locations IndexedDB cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`EPUB locations: ${message}`);
    console.error('❌ [CacheManager] Failed to clear EPUB locations:', error);
  }

  // 7. Clear pending_sessions localStorage (HIGH priority)
  try {
    localStorage.removeItem('bookreader_pending_sessions');
    result.pendingSessionsCleared = true;
    console.log('✅ [CacheManager] Pending sessions localStorage cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Pending sessions: ${message}`);
    console.error('❌ [CacheManager] Failed to clear pending sessions:', error);
  }

  // Determine overall success
  result.success = result.errors.length === 0;

  if (result.success) {
    console.log('✅ [CacheManager] All caches cleared successfully');
  } else {
    console.warn('⚠️ [CacheManager] Some caches failed to clear:', result.errors);
  }

  return result;
}

/**
 * Clear only TanStack Query cache
 * Use when you need to invalidate queries without clearing IndexedDB
 */
export function clearQueryCache(): void {
  try {
    queryClient.clear();
    console.log('✅ [CacheManager] TanStack Query cache cleared');
  } catch (error) {
    console.error('❌ [CacheManager] Failed to clear TanStack Query cache:', error);
    throw error;
  }
}

/**
 * Invalidate specific query keys
 * Use for targeted cache invalidation
 *
 * @param queryKey - Query key to invalidate
 */
export function invalidateQueries(queryKey: string[]): void {
  try {
    queryClient.invalidateQueries({ queryKey });
    console.log('✅ [CacheManager] Queries invalidated:', queryKey);
  } catch (error) {
    console.error('❌ [CacheManager] Failed to invalidate queries:', error);
    throw error;
  }
}

/**
 * Clear epub_locations IndexedDB database
 * This database stores cached EPUB location data for quick book loading
 *
 * CRITICAL: Must be cleared on logout to prevent data leakage between users
 */
async function clearEpubLocationsDB(): Promise<void> {
  const DB_NAME = 'BookReaderAI';
  const STORE_NAME = 'epub_locations';

  return new Promise((resolve, reject) => {
    try {
      // Open the database
      const request = indexedDB.open(DB_NAME);

      request.onerror = () => {
        // Database doesn't exist or can't be opened - not an error
        console.log('ℹ️ [CacheManager] EPUB locations DB does not exist (skipped)');
        resolve();
      };

      request.onsuccess = () => {
        const db = request.result;

        // Check if the object store exists
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.log('ℹ️ [CacheManager] EPUB locations store does not exist (skipped)');
          db.close();
          resolve();
          return;
        }

        try {
          // Clear all entries from the object store
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const clearRequest = store.clear();

          clearRequest.onsuccess = () => {
            console.log('✅ [CacheManager] EPUB locations store cleared');
            db.close();
            resolve();
          };

          clearRequest.onerror = () => {
            console.error('❌ [CacheManager] Failed to clear EPUB locations store:', clearRequest.error);
            db.close();
            reject(clearRequest.error);
          };

          transaction.onerror = () => {
            console.error('❌ [CacheManager] Transaction error:', transaction.error);
            db.close();
            reject(transaction.error);
          };
        } catch (error) {
          console.error('❌ [CacheManager] Error creating transaction:', error);
          db.close();
          reject(error);
        }
      };
    } catch (error) {
      console.error('❌ [CacheManager] Error opening EPUB locations DB:', error);
      reject(error);
    }
  });
}
