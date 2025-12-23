/**
 * Cache Manager - Unified cache clearing utility
 *
 * Provides centralized cache management for authentication flows.
 * Clears all application caches including:
 * - TanStack Query cache
 * - IndexedDB caches (chapterCache, imageCache)
 * - Reader store state
 *
 * CRITICAL: Must be called on logout to prevent data leakage between users!
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
    await chapterCache.clearAll();
    result.chapterCacheCleared = true;
    console.log('✅ [CacheManager] Chapter cache cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Chapter cache: ${message}`);
    console.error('❌ [CacheManager] Failed to clear chapter cache:', error);
  }

  // 3. Clear IndexedDB image cache
  try {
    await imageCache.clearAll();
    result.imageCacheCleared = true;
    console.log('✅ [CacheManager] Image cache cleared');
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
