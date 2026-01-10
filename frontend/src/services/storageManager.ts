/**
 * Storage Manager Service
 *
 * Manages storage quota, LRU cleanup, and persistent storage for PWA.
 * Uses Storage API for quota estimation and IndexedDB via Dexie for data management.
 *
 * @module services/storageManager
 */

import {
  db,
  MAX_CACHE_SIZE,
  STORAGE_WARNING_THRESHOLD,
  STORAGE_CRITICAL_THRESHOLD,
  CHAPTER_CACHE_TTL,
} from './db'

// ============================================================================
// Types
// ============================================================================

/** Complete storage information */
export interface StorageInfo {
  /** Used bytes */
  used: number
  /** Available quota */
  quota: number
  /** Free bytes */
  available: number
  /** Usage percentage (0-100) */
  percentUsed: number
  /** Warning level (>80%) */
  isWarning: boolean
  /** Critical level (>95%) */
  isCritical: boolean
  /** Persistent storage is active */
  isPersistent: boolean
  /** Number of offline books */
  offlineBooksCount: number
  /** Number of cached chapters */
  chaptersCount: number
  /** Number of cached images */
  imagesCount: number
}

/** Storage breakdown by data type */
export interface StorageBreakdown {
  /** Chapters size in bytes */
  chapters: number
  /** Images size in bytes */
  images: number
  /** Sync queue size in bytes */
  syncQueue: number
  /** Reading progress size in bytes */
  readingProgress: number
  /** Offline books metadata size in bytes */
  offlineBooks: number
}

/** Cleanup result */
export interface CleanupResult {
  /** Bytes freed */
  freedBytes: number
  /** Number of items removed */
  itemsRemoved: number
  /** Whether target was reached */
  targetReached: boolean
}

// ============================================================================
// Storage Manager Class
// ============================================================================

/**
 * Manages storage quota, LRU cleanup, and persistent storage.
 *
 * Features:
 * - Storage quota estimation via Storage API
 * - Persistent storage request (important for iOS)
 * - LRU-based cleanup strategy
 * - Storage breakdown by data type
 */
class StorageManager {
  private readonly LOG_PREFIX = '[StorageManager]'

  // ==========================================================================
  // Storage API Methods
  // ==========================================================================

  /**
   * Get storage estimate via Storage API
   * Falls back to MAX_CACHE_SIZE if API is unavailable
   */
  async getStorageEstimate(): Promise<StorageEstimate> {
    if (navigator.storage?.estimate) {
      try {
        return await navigator.storage.estimate()
      } catch (error) {
        console.warn(`${this.LOG_PREFIX} Failed to get storage estimate:`, error)
      }
    }
    // Fallback if API is unavailable
    return { quota: MAX_CACHE_SIZE, usage: 0 }
  }

  /**
   * Request persistent storage (important for iOS!)
   * Prevents browser from evicting data under storage pressure
   */
  async requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage?.persist) {
      console.warn(`${this.LOG_PREFIX} Persistent storage API not available`)
      return false
    }

    // Check current status
    const persisted = await navigator.storage.persisted()
    if (persisted) {
      console.log(`${this.LOG_PREFIX} Storage already persistent`)
      return true
    }

    // Request persistence
    try {
      const granted = await navigator.storage.persist()
      console.log(
        `${this.LOG_PREFIX} Persistent storage:`,
        granted ? 'granted' : 'denied'
      )
      return granted
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to request persistent storage:`, error)
      return false
    }
  }

  /**
   * Check if storage is persistent
   */
  async isPersistent(): Promise<boolean> {
    if (!navigator.storage?.persisted) return false
    try {
      return await navigator.storage.persisted()
    } catch {
      return false
    }
  }

  // ==========================================================================
  // Storage Info Methods
  // ==========================================================================

  /**
   * Get complete storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    const [estimate, isPersistent, breakdown, counts] = await Promise.all([
      this.getStorageEstimate(),
      this.isPersistent(),
      this.getStorageBreakdown(),
      this.getCounts(),
    ])

    const totalBreakdown =
      breakdown.chapters +
      breakdown.images +
      breakdown.syncQueue +
      breakdown.readingProgress +
      breakdown.offlineBooks

    const quota = Math.min(estimate.quota || MAX_CACHE_SIZE, MAX_CACHE_SIZE)
    const used = estimate.usage || totalBreakdown
    const percentUsed = quota > 0 ? (used / quota) * 100 : 0

    return {
      used,
      quota,
      available: Math.max(0, quota - used),
      percentUsed,
      isWarning: percentUsed >= STORAGE_WARNING_THRESHOLD * 100,
      isCritical: percentUsed >= STORAGE_CRITICAL_THRESHOLD * 100,
      isPersistent,
      offlineBooksCount: counts.offlineBooks,
      chaptersCount: counts.chapters,
      imagesCount: counts.images,
    }
  }

  /**
   * Get storage breakdown by data type
   */
  async getStorageBreakdown(): Promise<StorageBreakdown> {
    const [chapters, images, syncQueue, readingProgress, offlineBooks] =
      await Promise.all([
        this.calculateChaptersSize(),
        this.calculateImagesSize(),
        this.calculateSyncQueueSize(),
        this.calculateReadingProgressSize(),
        this.calculateOfflineBooksSize(),
      ])

    return {
      chapters,
      images,
      syncQueue,
      readingProgress,
      offlineBooks,
    }
  }

  /**
   * Check if download of given size is possible
   * Leaves 20% safety margin
   */
  async canDownload(estimatedSizeBytes: number): Promise<boolean> {
    const info = await this.getStorageInfo()
    // Leave 20% safety margin
    return info.available > estimatedSizeBytes * 1.2
  }

  // ==========================================================================
  // Cleanup Methods
  // ==========================================================================

  /**
   * Perform LRU cleanup to free up space
   * Prioritizes: old images -> old chapters -> sync queue (only failed)
   */
  async performCleanup(targetFreeBytes: number): Promise<CleanupResult> {
    let freedBytes = 0
    let itemsRemoved = 0

    console.log(
      `${this.LOG_PREFIX} Starting cleanup, target: ${this.formatBytes(targetFreeBytes)}`
    )

    // 1. Remove old images first (largest footprint)
    const imageResult = await this.cleanupOldImages(targetFreeBytes - freedBytes)
    freedBytes += imageResult.freedBytes
    itemsRemoved += imageResult.itemsRemoved

    if (freedBytes >= targetFreeBytes) {
      return { freedBytes, itemsRemoved, targetReached: true }
    }

    // 2. Remove old chapters (not accessed for CHAPTER_CACHE_TTL)
    const chapterResult = await this.cleanupOldChapters(targetFreeBytes - freedBytes)
    freedBytes += chapterResult.freedBytes
    itemsRemoved += chapterResult.itemsRemoved

    if (freedBytes >= targetFreeBytes) {
      return { freedBytes, itemsRemoved, targetReached: true }
    }

    // 3. Remove failed sync operations (only failed, not pending!)
    const syncResult = await this.cleanupFailedSyncOperations()
    freedBytes += syncResult.freedBytes
    itemsRemoved += syncResult.itemsRemoved

    // 4. Update offline books status after cleanup
    await this.updateOfflineBooksStatus()

    console.log(
      `${this.LOG_PREFIX} Cleanup complete: freed ${this.formatBytes(freedBytes)}, removed ${itemsRemoved} items`
    )

    return {
      freedBytes,
      itemsRemoved,
      targetReached: freedBytes >= targetFreeBytes,
    }
  }

  /**
   * Clean up old images using LRU strategy
   */
  private async cleanupOldImages(
    targetBytes: number
  ): Promise<{ freedBytes: number; itemsRemoved: number }> {
    let freedBytes = 0
    let itemsRemoved = 0

    const oldImages = await db.images.orderBy('cachedAt').limit(100).toArray()

    for (const img of oldImages) {
      if (freedBytes >= targetBytes) break
      freedBytes += img.size
      itemsRemoved++
      await db.images.delete(img.id)
    }

    if (itemsRemoved > 0) {
      console.log(
        `${this.LOG_PREFIX} Removed ${itemsRemoved} images, freed ${this.formatBytes(freedBytes)}`
      )
    }

    return { freedBytes, itemsRemoved }
  }

  /**
   * Clean up old chapters using LRU strategy
   */
  private async cleanupOldChapters(
    targetBytes: number
  ): Promise<{ freedBytes: number; itemsRemoved: number }> {
    let freedBytes = 0
    let itemsRemoved = 0

    const cutoffTime = Date.now() - CHAPTER_CACHE_TTL

    const oldChapters = await db.chapters
      .where('lastAccessedAt')
      .below(cutoffTime)
      .limit(100)
      .toArray()

    for (const ch of oldChapters) {
      if (freedBytes >= targetBytes) break

      const chapterSize = this.estimateChapterSize(ch)
      freedBytes += chapterSize
      itemsRemoved++
      await db.chapters.delete(ch.id)
    }

    if (itemsRemoved > 0) {
      console.log(
        `${this.LOG_PREFIX} Removed ${itemsRemoved} chapters, freed ${this.formatBytes(freedBytes)}`
      )
    }

    return { freedBytes, itemsRemoved }
  }

  /**
   * Clean up failed sync operations (NOT pending ones!)
   */
  private async cleanupFailedSyncOperations(): Promise<{
    freedBytes: number
    itemsRemoved: number
  }> {
    let freedBytes = 0
    let itemsRemoved = 0

    // Only remove failed operations that exceeded max retries
    const failedOps = await db.syncQueue
      .where('status')
      .equals('failed')
      .toArray()

    const toRemove = failedOps.filter((op) => op.retries >= op.maxRetries)

    for (const op of toRemove) {
      freedBytes += JSON.stringify(op).length
      itemsRemoved++
      await db.syncQueue.delete(op.id)
    }

    if (itemsRemoved > 0) {
      console.log(
        `${this.LOG_PREFIX} Removed ${itemsRemoved} failed sync operations`
      )
    }

    return { freedBytes, itemsRemoved }
  }

  /**
   * Clear all offline data
   * WARNING: Does NOT clear sync queue (may contain important operations)
   */
  async clearAllOfflineData(): Promise<void> {
    console.log(`${this.LOG_PREFIX} Clearing all offline data`)

    await db.transaction(
      'rw',
      db.offlineBooks,
      db.chapters,
      db.images,
      db.readingProgress,
      async () => {
        await db.offlineBooks.clear()
        await db.chapters.clear()
        await db.images.clear()
        await db.readingProgress.clear()
        // syncQueue is NOT cleared - may contain important pending operations
      }
    )

    // Clear Service Worker caches
    await this.clearServiceWorkerCaches()

    console.log(`${this.LOG_PREFIX} All offline data cleared`)
  }

  /**
   * Clear data for a specific book
   */
  async clearBookData(userId: string, bookId: string): Promise<number> {
    let freedBytes = 0

    await db.transaction(
      'rw',
      db.offlineBooks,
      db.chapters,
      db.images,
      db.readingProgress,
      async () => {
        // Calculate size before deletion
        const chapters = await db.chapters
          .where('[userId+bookId]')
          .equals([userId, bookId])
          .toArray()

        const images = await db.images.where({ userId, bookId }).toArray()

        for (const ch of chapters) {
          freedBytes += this.estimateChapterSize(ch)
        }
        for (const img of images) {
          freedBytes += img.size
        }

        // Delete data
        await db.offlineBooks.delete(`${userId}:${bookId}`)
        await db.chapters.where('[userId+bookId]').equals([userId, bookId]).delete()
        await db.images.where({ userId, bookId }).delete()
        await db.readingProgress.delete(`${userId}:${bookId}`)
      }
    )

    console.log(
      `${this.LOG_PREFIX} Cleared book ${bookId}, freed ${this.formatBytes(freedBytes)}`
    )

    return freedBytes
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private async calculateChaptersSize(): Promise<number> {
    const chapters = await db.chapters.toArray()
    return chapters.reduce((total, ch) => total + this.estimateChapterSize(ch), 0)
  }

  private async calculateImagesSize(): Promise<number> {
    const images = await db.images.toArray()
    return images.reduce((total, img) => total + img.size, 0)
  }

  private async calculateSyncQueueSize(): Promise<number> {
    const ops = await db.syncQueue.toArray()
    return ops.reduce((total, op) => total + JSON.stringify(op).length, 0)
  }

  private async calculateReadingProgressSize(): Promise<number> {
    const progress = await db.readingProgress.toArray()
    return progress.reduce((total, p) => total + JSON.stringify(p).length, 0)
  }

  private async calculateOfflineBooksSize(): Promise<number> {
    const books = await db.offlineBooks.toArray()
    return books.reduce((total, b) => total + JSON.stringify(b).length, 0)
  }

  private async getCounts(): Promise<{
    offlineBooks: number
    chapters: number
    images: number
  }> {
    const [offlineBooks, chapters, images] = await Promise.all([
      db.offlineBooks.count(),
      db.chapters.count(),
      db.images.count(),
    ])
    return { offlineBooks, chapters, images }
  }

  private estimateChapterSize(chapter: {
    content: string
    descriptions: unknown[]
  }): number {
    const contentSize = new Blob([chapter.content]).size
    const descriptionsSize = JSON.stringify(chapter.descriptions).length
    return contentSize + descriptionsSize
  }

  /**
   * Update offline books status after chapters were deleted
   */
  private async updateOfflineBooksStatus(): Promise<void> {
    const offlineBooks = await db.offlineBooks.toArray()

    for (const book of offlineBooks) {
      const chapterCount = await db.chapters
        .where('[userId+bookId]')
        .equals([book.userId, book.bookId])
        .count()

      if (chapterCount === 0) {
        await db.offlineBooks.delete(book.id)
      } else if (chapterCount < book.metadata.totalChapters) {
        await db.offlineBooks.update(book.id, { status: 'partial' })
      }
    }
  }

  /**
   * Clear Service Worker caches
   */
  private async clearServiceWorkerCaches(): Promise<void> {
    if (!('caches' in window)) return

    try {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter(
            (name) => name.startsWith('fancai-') || name.includes('images')
          )
          .map((name) => caches.delete(name))
      )
    } catch (error) {
      console.warn(`${this.LOG_PREFIX} Failed to clear SW caches:`, error)
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    if (bytes < 0) return '-' + this.formatBytes(-bytes)

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const value = bytes / Math.pow(k, i)

    return `${value.toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Singleton instance of StorageManager */
export const storageManager = new StorageManager()
