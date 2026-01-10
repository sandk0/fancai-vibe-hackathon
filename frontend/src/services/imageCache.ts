/**
 * IndexedDB Image Cache Service (Dexie.js)
 *
 * Provides offline caching for generated images using Dexie.js.
 * Migrated from raw IndexedDB for improved developer experience and reliability.
 *
 * Features:
 * - Store images as blobs in IndexedDB via Dexie
 * - Cache expiration (30 days default)
 * - Cache size management
 * - Object URL tracking and cleanup
 * - User data isolation
 *
 * @module services/imageCache
 */

import { db, createImageId, IMAGE_CACHE_TTL, type CachedImage } from './db'
import { STORAGE_KEYS } from '@/types/state'

const MAX_CACHE_SIZE_MB = 100 // Maximum cache size in MB

interface CacheStats {
  totalImages: number
  totalSizeBytes: number
  oldestCacheDate: Date | null
  newestCacheDate: Date | null
}

/**
 * Metadata for tracking Object URLs
 */
interface ObjectURLTracker {
  url: string
  createdAt: number
}

/**
 * Image Cache Service using Dexie.js
 */
class ImageCacheService {
  /**
   * Map for tracking created Object URLs
   * Key: descriptionId, Value: ObjectURLTracker
   */
  private objectURLs: Map<string, ObjectURLTracker> = new Map()

  /**
   * Interval ID for automatic cleanup
   */
  private cleanupIntervalId: number | null = null

  /**
   * Maximum age of Object URL in milliseconds (30 minutes)
   */
  private readonly MAX_OBJECT_URL_AGE_MS = 30 * 60 * 1000

  constructor() {
    // Start auto cleanup on initialization
    this.startAutoCleanup()
  }

  /**
   * Check if image is cached
   */
  async has(userId: string, descriptionId: string): Promise<boolean> {
    try {
      const id = createImageId(userId, descriptionId)
      const image = await db.images.get(id)

      if (!image) return false

      // Check expiration
      if (this.isExpired(image.cachedAt)) {
        // Delete expired entry asynchronously
        this.delete(userId, descriptionId).catch(() => {})
        return false
      }

      return true
    } catch (err) {
      console.warn('[ImageCache] Error checking cache:', err)
      return false
    }
  }

  /**
   * Get cached image as object URL
   * Returns null if not cached or expired
   *
   * IMPORTANT: The returned URL must be released via release() when no longer needed,
   * otherwise there will be a memory leak!
   */
  async get(userId: string, descriptionId: string): Promise<string | null> {
    try {
      // Check if we already have an Object URL for this description
      const existing = this.objectURLs.get(descriptionId)
      if (existing) {
        console.log('[ImageCache] Reusing existing Object URL for:', descriptionId)
        return existing.url
      }

      const id = createImageId(userId, descriptionId)
      const image = await db.images.get(id)

      if (!image) {
        console.log('[ImageCache] Cache miss for:', descriptionId)
        return null
      }

      // Check expiration
      if (this.isExpired(image.cachedAt)) {
        console.log('[ImageCache] Cache expired for:', descriptionId)
        await this.delete(userId, descriptionId)
        return null
      }

      // Create object URL from blob
      const objectUrl = URL.createObjectURL(image.blob)

      // Track Object URL for later cleanup
      this.objectURLs.set(descriptionId, {
        url: objectUrl,
        createdAt: Date.now(),
      })

      console.log('[ImageCache] Cache hit for:', descriptionId, `(tracked: ${this.objectURLs.size} URLs)`)
      return objectUrl
    } catch (err) {
      console.warn('[ImageCache] Error reading cache:', err)
      return null
    }
  }

  /**
   * Release Object URL for a description
   * Should be called when the image is no longer needed (e.g., on component unmount)
   *
   * @returns true if URL was released, false if URL not found
   */
  release(descriptionId: string): boolean {
    const tracker = this.objectURLs.get(descriptionId)
    if (tracker) {
      URL.revokeObjectURL(tracker.url)
      this.objectURLs.delete(descriptionId)
      console.log('[ImageCache] Released Object URL for:', descriptionId, `(tracked: ${this.objectURLs.size} URLs)`)
      return true
    }
    return false
  }

  /**
   * Release multiple Object URLs
   *
   * @returns Number of released URLs
   */
  releaseMany(descriptionIds: string[]): number {
    let releasedCount = 0
    for (const id of descriptionIds) {
      if (this.release(id)) {
        releasedCount++
      }
    }
    return releasedCount
  }

  /**
   * Store image in cache
   * Downloads the image from URL and stores as blob
   */
  async set(
    userId: string,
    descriptionId: string,
    imageUrl: string,
    bookId: string
  ): Promise<boolean> {
    try {
      // Download image as blob with Authorization header
      console.log('[ImageCache] Downloading image for caching:', descriptionId)
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const response = await fetch(imageUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      })

      if (!response.ok) {
        console.warn('[ImageCache] Failed to download image:', response.status)
        return false
      }

      const blob = await response.blob()
      const mimeType = blob.type || 'image/png'

      // Check cache size before adding
      await this.ensureCacheSize(userId, blob.size)

      const id = createImageId(userId, descriptionId)

      const cachedImage: CachedImage = {
        id,
        userId,
        descriptionId,
        bookId,
        blob,
        mimeType,
        size: blob.size,
        cachedAt: Date.now(),
      }

      await db.images.put(cachedImage)

      console.log('[ImageCache] Image cached:', {
        userId,
        descriptionId,
        size: (blob.size / 1024).toFixed(1) + 'KB',
      })

      return true
    } catch (err) {
      console.warn('[ImageCache] Error caching image:', err)
      return false
    }
  }

  /**
   * Delete cached image
   * Also releases corresponding Object URL if it exists
   */
  async delete(userId: string, descriptionId: string): Promise<boolean> {
    try {
      // Release Object URL if exists
      this.release(descriptionId)

      const id = createImageId(userId, descriptionId)
      await db.images.delete(id)

      console.log('[ImageCache] Deleted:', descriptionId)
      return true
    } catch (err) {
      console.warn('[ImageCache] Error deleting:', err)
      return false
    }
  }

  /**
   * Clear all cached images for a book
   * Also releases all related Object URLs
   */
  async clearBook(userId: string, bookId: string): Promise<number> {
    try {
      // Get images for this book and user
      const images = await db.images
        .where({ userId, bookId })
        .toArray()

      const descriptionIds = images.map(img => img.descriptionId)
      const ids = images.map(img => img.id)

      // Delete from database
      await db.images.bulkDelete(ids)

      // Release Object URLs
      if (descriptionIds.length > 0) {
        this.releaseMany(descriptionIds)
      }

      console.log('[ImageCache] Cleared book cache:', {
        userId,
        bookId,
        deletedCount: ids.length,
      })

      return ids.length
    } catch (err) {
      console.warn('[ImageCache] Error clearing book cache:', err)
      return 0
    }
  }

  /**
   * Clear all expired entries for a user
   */
  async clearExpired(userId: string): Promise<number> {
    try {
      const expirationTime = Date.now() - IMAGE_CACHE_TTL

      // Get expired images for this user
      const images = await db.images
        .where('userId')
        .equals(userId)
        .filter(img => img.cachedAt < expirationTime)
        .toArray()

      const ids = images.map(img => img.id)
      const descriptionIds = images.map(img => img.descriptionId)

      if (ids.length > 0) {
        await db.images.bulkDelete(ids)
        this.releaseMany(descriptionIds)
      }

      console.log('[ImageCache] Cleared expired entries:', {
        userId,
        deletedCount: ids.length,
      })

      return ids.length
    } catch (err) {
      console.warn('[ImageCache] Error clearing expired:', err)
      return 0
    }
  }

  /**
   * Clear all cached images for a user
   */
  async clearAll(userId: string): Promise<number> {
    try {
      const images = await db.images
        .where('userId')
        .equals(userId)
        .toArray()

      const ids = images.map(img => img.id)
      const descriptionIds = images.map(img => img.descriptionId)

      if (ids.length > 0) {
        await db.images.bulkDelete(ids)
        this.releaseMany(descriptionIds)
      }

      console.log('[ImageCache] All cache cleared for user:', {
        userId,
        deletedCount: ids.length,
      })

      return ids.length
    } catch (err) {
      console.warn('[ImageCache] Error clearing all:', err)
      return 0
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(userId?: string): Promise<CacheStats> {
    try {
      let images: CachedImage[]

      if (userId) {
        images = await db.images
          .where('userId')
          .equals(userId)
          .toArray()
      } else {
        images = await db.images.toArray()
      }

      const stats: CacheStats = {
        totalImages: images.length,
        totalSizeBytes: 0,
        oldestCacheDate: null,
        newestCacheDate: null,
      }

      for (const img of images) {
        stats.totalSizeBytes += img.size

        const cacheDate = new Date(img.cachedAt)
        if (!stats.oldestCacheDate || cacheDate < stats.oldestCacheDate) {
          stats.oldestCacheDate = cacheDate
        }
        if (!stats.newestCacheDate || cacheDate > stats.newestCacheDate) {
          stats.newestCacheDate = cacheDate
        }
      }

      console.log('[ImageCache] Stats:', {
        userId: userId || 'all',
        images: stats.totalImages,
        size: (stats.totalSizeBytes / 1024 / 1024).toFixed(2) + 'MB',
      })

      return stats
    } catch (err) {
      console.warn('[ImageCache] Error getting stats:', err)
      return {
        totalImages: 0,
        totalSizeBytes: 0,
        oldestCacheDate: null,
        newestCacheDate: null,
      }
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(cachedAt: number): boolean {
    return Date.now() - cachedAt > IMAGE_CACHE_TTL
  }

  /**
   * Ensure cache doesn't exceed size limit for a user
   * Deletes oldest entries if necessary
   */
  private async ensureCacheSize(userId: string, newEntrySize: number): Promise<void> {
    const stats = await this.getStats(userId)
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024

    if (stats.totalSizeBytes + newEntrySize > maxSizeBytes) {
      console.log('[ImageCache] Cache size exceeded, cleaning oldest entries...')

      // Clear expired first
      await this.clearExpired(userId)

      // If still over limit, delete oldest entries
      const newStats = await this.getStats(userId)
      if (newStats.totalSizeBytes + newEntrySize > maxSizeBytes) {
        // Assume ~50KB per image
        const entriesToDelete = Math.ceil((newStats.totalSizeBytes + newEntrySize - maxSizeBytes) / (50 * 1024))
        await this.deleteOldest(userId, entriesToDelete)
      }
    }
  }

  /**
   * Delete oldest N entries for a user
   */
  private async deleteOldest(userId: string, count: number): Promise<void> {
    try {
      const images = await db.images
        .where('userId')
        .equals(userId)
        .toArray()

      // Sort by cachedAt (oldest first)
      images.sort((a, b) => a.cachedAt - b.cachedAt)

      const toDelete = images.slice(0, count)
      const ids = toDelete.map(img => img.id)
      const descriptionIds = toDelete.map(img => img.descriptionId)

      if (ids.length > 0) {
        await db.images.bulkDelete(ids)
        this.releaseMany(descriptionIds)

        console.log('[ImageCache] Deleted oldest entries:', {
          userId,
          deleted: ids.length,
        })
      }
    } catch (err) {
      console.warn('[ImageCache] Error deleting oldest:', err)
    }
  }

  /**
   * Cleanup stale Object URLs (older than MAX_OBJECT_URL_AGE_MS)
   * Automatically called every 5 minutes
   *
   * @returns Number of released URLs
   */
  private cleanupStaleObjectURLs(): number {
    const now = Date.now()
    const staleIds: string[] = []

    Array.from(this.objectURLs.entries()).forEach(([id, tracker]) => {
      if (now - tracker.createdAt > this.MAX_OBJECT_URL_AGE_MS) {
        staleIds.push(id)
      }
    })

    if (staleIds.length > 0) {
      console.log('[ImageCache] Cleaning up stale Object URLs:', staleIds.length)
      return this.releaseMany(staleIds)
    }

    return 0
  }

  /**
   * Start automatic cleanup of stale Object URLs every 5 minutes
   */
  startAutoCleanup(): void {
    if (this.cleanupIntervalId !== null) {
      console.warn('[ImageCache] Auto-cleanup already started')
      return
    }

    // Run cleanup every 5 minutes
    this.cleanupIntervalId = window.setInterval(() => {
      this.cleanupStaleObjectURLs()
    }, 5 * 60 * 1000)

    console.log('[ImageCache] Auto-cleanup started (interval: 5 minutes)')
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId)
      this.cleanupIntervalId = null
      console.log('[ImageCache] Auto-cleanup stopped')
    }
  }

  /**
   * Full cleanup of all resources
   * Should be called on app/component unmount
   *
   * Releases:
   * - All Object URLs
   * - Stops auto-cleanup interval
   */
  destroy(): void {
    console.log('[ImageCache] Destroying service...')

    // Release all Object URLs
    const urlCount = this.objectURLs.size
    Array.from(this.objectURLs.values()).forEach((tracker) => {
      URL.revokeObjectURL(tracker.url)
    })
    this.objectURLs.clear()

    // Stop auto-cleanup
    this.stopAutoCleanup()

    console.log('[ImageCache] Service destroyed', {
      releasedURLs: urlCount,
    })
  }

  /**
   * Get count of active Object URLs
   */
  getActiveURLCount(): number {
    return this.objectURLs.size
  }
}

// Singleton instance
export const imageCache = new ImageCacheService()

// Export types
export type { CacheStats, ObjectURLTracker }
export type { CachedImage } from './db'
