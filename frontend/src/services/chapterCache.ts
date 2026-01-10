/**
 * IndexedDB Chapter Cache Service (Dexie.js)
 *
 * Provides offline caching for book chapters using Dexie.js.
 * Migrated from raw IndexedDB for improved developer experience and reliability.
 *
 * Features:
 * - Store chapters with descriptions in IndexedDB via Dexie
 * - TTL (Time To Live) - 7 days by default
 * - LRU (Least Recently Used) cleanup
 * - User data isolation
 * - Reactive queries with useLiveQuery support
 *
 * @module services/chapterCache
 */

import { db, createChapterId, CHAPTER_CACHE_TTL, type CachedChapter, type CachedDescription } from './db'
import type { Description, GeneratedImage } from '@/types/api'

const MAX_CHAPTERS_PER_BOOK = 50

interface CacheStats {
  totalChapters: number
  chaptersByBook: Record<string, number>
  oldestCacheDate: Date | null
  newestCacheDate: Date | null
}

/**
 * Convert API Description to CachedDescription
 */
function toCachedDescription(desc: Description): CachedDescription {
  const typeMap: Record<string, CachedDescription['type']> = {
    location: 'setting',
    character: 'character',
    atmosphere: 'scene',
    object: 'object',
    action: 'scene',
  }

  return {
    id: desc.id,
    content: desc.content,
    type: typeMap[desc.type] || 'scene',
    confidence: desc.confidence_score,
    imageUrl: desc.generated_image?.image_url ?? null,
    imageStatus: desc.generated_image
      ? (desc.generated_image.status === 'completed' ? 'generated' : 'pending')
      : 'none',
  }
}

/**
 * Convert CachedDescription back to API Description format
 */
function fromCachedDescription(cached: CachedDescription): Description {
  const typeMap: Record<CachedDescription['type'], Description['type']> = {
    setting: 'location',
    character: 'character',
    scene: 'atmosphere',
    object: 'object',
  }

  return {
    id: cached.id,
    type: typeMap[cached.type] || 'atmosphere',
    content: cached.content,
    text: cached.content,
    confidence_score: cached.confidence,
    priority_score: cached.confidence,
    entities_mentioned: [],
    generated_image: cached.imageUrl ? {
      id: '',
      service_used: 'cached',
      status: cached.imageStatus === 'generated' ? 'completed' : 'pending',
      image_url: cached.imageUrl,
      is_moderated: false,
      view_count: 0,
      download_count: 0,
      created_at: new Date().toISOString(),
      description: {
        id: cached.id,
        type: typeMap[cached.type] || 'atmosphere',
        text: cached.content,
        content: cached.content,
        confidence_score: cached.confidence,
        priority_score: cached.confidence,
      },
      chapter: {
        id: '',
        number: 0,
        title: '',
      },
    } : undefined,
  }
}

/**
 * Chapter Cache Service using Dexie.js
 */
class ChapterCacheService {
  /**
   * Check if chapter exists in cache and is not expired
   */
  async has(userId: string, bookId: string, chapterNumber: number): Promise<boolean> {
    try {
      const id = createChapterId(userId, bookId, chapterNumber)
      const chapter = await db.chapters.get(id)

      if (!chapter) return false

      // Check expiration
      if (this.isExpired(chapter.cachedAt)) {
        // Delete expired entry asynchronously
        this.delete(userId, bookId, chapterNumber).catch(() => {})
        return false
      }

      return true
    } catch (err) {
      console.warn('[ChapterCache] Error checking cache:', err)
      return false
    }
  }

  /**
   * Get chapter from cache
   * Returns null if not cached or expired
   */
  async get(
    userId: string,
    bookId: string,
    chapterNumber: number
  ): Promise<{ descriptions: Description[]; images: GeneratedImage[] } | null> {
    try {
      const id = createChapterId(userId, bookId, chapterNumber)
      const chapter = await db.chapters.get(id)

      if (!chapter) {
        console.log('[ChapterCache] Cache miss for:', { userId, bookId, chapterNumber })
        return null
      }

      // Check expiration
      if (this.isExpired(chapter.cachedAt)) {
        console.log('[ChapterCache] Cache expired for:', { userId, bookId, chapterNumber })
        await this.delete(userId, bookId, chapterNumber)
        return null
      }

      // Update lastAccessedAt for LRU
      await db.chapters.update(id, { lastAccessedAt: Date.now() })

      // Convert cached descriptions to API format
      const descriptions = chapter.descriptions.map(fromCachedDescription)

      // Extract images from descriptions
      const images = descriptions
        .filter(d => d.generated_image)
        .map(d => d.generated_image as GeneratedImage)

      console.log('[ChapterCache] Cache hit for:', {
        userId,
        bookId,
        chapterNumber,
        descriptionsCount: descriptions.length,
        imagesCount: images.length,
      })

      return { descriptions, images }
    } catch (err) {
      console.warn('[ChapterCache] Error reading cache:', err)
      return null
    }
  }

  /**
   * Store chapter in cache
   */
  async set(
    userId: string,
    bookId: string,
    chapterNumber: number,
    descriptions: Description[],
    images: GeneratedImage[]
  ): Promise<boolean> {
    try {
      // Enforce book limit
      await this.ensureBookLimit(userId, bookId)

      const id = createChapterId(userId, bookId, chapterNumber)
      const now = Date.now()

      // Merge images into descriptions
      const descriptionsWithImages = descriptions.map(desc => {
        const image = images.find(img => img.description_id === desc.id || img.description?.id === desc.id)
        if (image && !desc.generated_image) {
          return { ...desc, generated_image: image }
        }
        return desc
      })

      // Convert to cached format
      const cachedDescriptions = descriptionsWithImages.map(toCachedDescription)

      const cachedChapter: CachedChapter = {
        id,
        userId,
        bookId,
        chapterNumber,
        title: '', // Will be set from chapter content if available
        content: '', // Content stored separately if needed
        descriptions: cachedDescriptions,
        wordCount: 0,
        cachedAt: now,
        lastAccessedAt: now,
      }

      await db.chapters.put(cachedChapter)

      console.log('[ChapterCache] Chapter cached:', {
        userId,
        bookId,
        chapterNumber,
        descriptionsCount: descriptions.length,
        imagesCount: images.length,
      })

      return true
    } catch (err) {
      console.warn('[ChapterCache] Error caching chapter:', err)
      return false
    }
  }

  /**
   * Delete chapter from cache
   */
  async delete(userId: string, bookId: string, chapterNumber: number): Promise<boolean> {
    try {
      const id = createChapterId(userId, bookId, chapterNumber)
      await db.chapters.delete(id)
      console.log('[ChapterCache] Deleted:', { userId, bookId, chapterNumber })
      return true
    } catch (err) {
      console.warn('[ChapterCache] Error deleting:', err)
      return false
    }
  }

  /**
   * Clear all chapters for a book
   */
  async clearBook(userId: string, bookId: string): Promise<number> {
    try {
      const deletedCount = await db.chapters
        .where('[userId+bookId]')
        .equals([userId, bookId])
        .delete()

      console.log('[ChapterCache] Cleared book cache:', { userId, bookId, deletedCount })
      return deletedCount
    } catch (err) {
      console.warn('[ChapterCache] Error clearing book cache:', err)
      return 0
    }
  }

  /**
   * Clear expired entries
   */
  async clearExpired(): Promise<number> {
    try {
      const expirationTime = Date.now() - CHAPTER_CACHE_TTL

      const deletedCount = await db.chapters
        .where('lastAccessedAt')
        .below(expirationTime)
        .delete()

      console.log('[ChapterCache] Cleared expired entries:', deletedCount)
      return deletedCount
    } catch (err) {
      console.warn('[ChapterCache] Error clearing expired:', err)
      return 0
    }
  }

  /**
   * Clear all cached chapters for a user
   */
  async clearAll(userId: string): Promise<number> {
    try {
      // Get all chapters for user
      const chapters = await db.chapters
        .filter(ch => ch.userId === userId)
        .toArray()

      const ids = chapters.map(ch => ch.id)
      await db.chapters.bulkDelete(ids)

      console.log('[ChapterCache] All cache cleared for user:', { userId, deletedCount: ids.length })
      return ids.length
    } catch (err) {
      console.warn('[ChapterCache] Error clearing all:', err)
      return 0
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const chapters = await db.chapters.toArray()

      const stats: CacheStats = {
        totalChapters: chapters.length,
        chaptersByBook: {},
        oldestCacheDate: null,
        newestCacheDate: null,
      }

      for (const chapter of chapters) {
        // Count by book
        if (!stats.chaptersByBook[chapter.bookId]) {
          stats.chaptersByBook[chapter.bookId] = 0
        }
        stats.chaptersByBook[chapter.bookId]++

        // Track dates
        const cacheDate = new Date(chapter.cachedAt)
        if (!stats.oldestCacheDate || cacheDate < stats.oldestCacheDate) {
          stats.oldestCacheDate = cacheDate
        }
        if (!stats.newestCacheDate || cacheDate > stats.newestCacheDate) {
          stats.newestCacheDate = cacheDate
        }
      }

      console.log('[ChapterCache] Stats:', {
        totalChapters: stats.totalChapters,
        booksCount: Object.keys(stats.chaptersByBook).length,
      })

      return stats
    } catch (err) {
      console.warn('[ChapterCache] Error getting stats:', err)
      return {
        totalChapters: 0,
        chaptersByBook: {},
        oldestCacheDate: null,
        newestCacheDate: null,
      }
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(cachedAt: number): boolean {
    return Date.now() - cachedAt > CHAPTER_CACHE_TTL
  }

  /**
   * Enforce maximum chapters per book (LRU cleanup)
   */
  private async ensureBookLimit(userId: string, bookId: string): Promise<void> {
    try {
      const chapters = await db.chapters
        .where('[userId+bookId]')
        .equals([userId, bookId])
        .toArray()

      if (chapters.length >= MAX_CHAPTERS_PER_BOOK) {
        console.log('[ChapterCache] Book limit reached, applying LRU cleanup...')

        // Sort by lastAccessedAt (oldest first)
        chapters.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

        // Delete oldest entries
        const toDelete = chapters.slice(0, chapters.length - MAX_CHAPTERS_PER_BOOK + 1)
        const idsToDelete = toDelete.map(ch => ch.id)
        await db.chapters.bulkDelete(idsToDelete)

        console.log('[ChapterCache] Deleted LRU entries:', toDelete.length)
      }
    } catch (err) {
      console.warn('[ChapterCache] Error ensuring book limit:', err)
    }
  }

  /**
   * Clear entries with empty descriptions
   * (Useful during migration to on-demand extraction)
   */
  async clearEmptyDescriptions(): Promise<number> {
    try {
      const chapters = await db.chapters.toArray()
      const emptyChapters = chapters.filter(ch => !ch.descriptions || ch.descriptions.length === 0)
      const idsToDelete = emptyChapters.map(ch => ch.id)

      await db.chapters.bulkDelete(idsToDelete)

      console.log('[ChapterCache] Cleared empty description entries:', idsToDelete.length)
      return idsToDelete.length
    } catch (err) {
      console.warn('[ChapterCache] Error clearing empty:', err)
      return 0
    }
  }

  /**
   * Clear legacy data without userId
   * Called automatically for migration
   */
  async clearLegacyData(): Promise<number> {
    try {
      const chapters = await db.chapters.toArray()
      const legacyChapters = chapters.filter(ch => !ch.userId)
      const idsToDelete = legacyChapters.map(ch => ch.id)

      if (idsToDelete.length > 0) {
        await db.chapters.bulkDelete(idsToDelete)
        console.log('[ChapterCache] Cleared legacy data without userId:', idsToDelete.length)
      }

      return idsToDelete.length
    } catch (err) {
      console.warn('[ChapterCache] Error clearing legacy data:', err)
      return 0
    }
  }

  /**
   * Perform maintenance tasks (cleanup expired, empty, legacy data)
   */
  async performMaintenance(): Promise<void> {
    console.log('[ChapterCache] Performing maintenance...')
    await this.clearLegacyData()
    await this.clearExpired()
    await this.clearEmptyDescriptions()
    const stats = await this.getStats()
    console.log('[ChapterCache] Maintenance complete:', stats)
  }
}

// Singleton instance
export const chapterCache = new ChapterCacheService()

// Export types for compatibility
export type { CacheStats }
export type { CachedChapter, CachedDescription } from './db'
