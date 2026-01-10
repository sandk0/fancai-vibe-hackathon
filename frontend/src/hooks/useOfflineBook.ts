/**
 * React hook for offline book management with Dexie.js
 *
 * Provides reactive access to offline book data using useLiveQuery.
 * Automatically updates when IndexedDB data changes.
 *
 * @module hooks/useOfflineBook
 */

import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  createOfflineBookId,
} from '@/services/db'
import { useAuthStore } from '@/stores/auth'

/**
 * Hook for working with a specific offline book
 * Uses useLiveQuery for reactive updates when data changes
 *
 * @param bookId - Book ID to query
 * @returns Reactive offline book state
 */
export function useOfflineBook(bookId: string) {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? ''

  // Reactive query to offline book metadata
  const offlineBook = useLiveQuery(
    async () => {
      if (!userId || !bookId) return undefined
      return db.offlineBooks.get(createOfflineBookId(userId, bookId))
    },
    [userId, bookId],
    undefined // Default value while loading
  )

  // Reactive query to cached chapters
  const cachedChapters = useLiveQuery(
    async () => {
      if (!userId || !bookId) return []
      return db.chapters
        .where('[userId+bookId]')
        .equals([userId, bookId])
        .toArray()
    },
    [userId, bookId],
    [] // Default to empty array
  )

  // Count of cached images for this book
  const cachedImagesCount = useLiveQuery(
    async () => {
      if (!userId || !bookId) return 0
      return db.images.where({ userId, bookId }).count()
    },
    [userId, bookId],
    0
  )

  const isAvailableOffline = offlineBook?.status === 'complete'
  const isDownloading = offlineBook?.status === 'downloading'
  const downloadProgress = offlineBook?.downloadProgress ?? 0
  const cachedChapterNumbers = cachedChapters
    .map((ch) => ch.chapterNumber)
    .sort((a, b) => a - b)

  return {
    /** Offline book metadata */
    offlineBook,
    /** All cached chapters for this book */
    cachedChapters,
    /** Sorted array of cached chapter numbers */
    cachedChapterNumbers,
    /** Number of cached images for this book */
    cachedImagesCount,
    /** Whether the book is fully available offline */
    isAvailableOffline,
    /** Whether the book is currently being downloaded */
    isDownloading,
    /** Download progress (0-100) */
    downloadProgress,
    /** Whether the data is still loading */
    isLoading: offlineBook === undefined,
  }
}

/**
 * Hook for getting all offline books for the current user
 * Uses useLiveQuery for reactive updates
 *
 * @returns List of offline books and total storage size
 */
export function useOfflineBooks() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? ''

  // Reactive query to all offline books for user
  const offlineBooks = useLiveQuery(
    async () => {
      if (!userId) return []
      return db.offlineBooks
        .where('userId')
        .equals(userId)
        .toArray()
    },
    [userId],
    []
  )

  // Calculate total storage size
  const totalSize = useLiveQuery(
    async () => {
      if (!userId) return 0

      // Get all chapters and images for the user
      const [chapters, images] = await Promise.all([
        db.chapters.filter((ch) => ch.userId === userId).toArray(),
        db.images.where('userId').equals(userId).toArray(),
      ])

      // Calculate chapter content size (rough estimate)
      const chaptersSize = chapters.reduce(
        (sum: number, ch) => sum + new Blob([ch.content]).size,
        0
      )

      // Sum image sizes
      const imagesSize = images.reduce((sum: number, img) => sum + img.size, 0)

      return chaptersSize + imagesSize
    },
    [userId],
    0
  )

  return {
    /** List of all offline books for the user */
    offlineBooks,
    /** Total storage size in bytes */
    totalSize,
    /** Whether the data is still loading */
    isLoading: offlineBooks.length === 0 && userId !== '',
  }
}

/**
 * Hook for checking if a specific chapter is cached
 *
 * @param bookId - Book ID
 * @param chapterNumber - Chapter number
 * @returns Whether the chapter is cached
 */
export function useIsChapterCached(bookId: string, chapterNumber: number) {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? ''

  const isCached = useLiveQuery(
    async () => {
      if (!userId || !bookId || chapterNumber < 1) return false

      const count = await db.chapters
        .where('[userId+bookId+chapterNumber]')
        .equals([userId, bookId, chapterNumber])
        .count()

      return count > 0
    },
    [userId, bookId, chapterNumber],
    false
  )

  return isCached
}

/**
 * Hook for getting reading progress from offline storage
 *
 * @param bookId - Book ID
 * @returns Offline reading progress
 */
export function useOfflineReadingProgress(bookId: string) {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? ''

  const progress = useLiveQuery(
    async () => {
      if (!userId || !bookId) return null
      return db.readingProgress.get(`${userId}:${bookId}`)
    },
    [userId, bookId],
    null
  )

  return progress
}

/**
 * Hook for getting pending sync operations count
 *
 * @returns Number of pending sync operations
 */
export function usePendingSyncCount() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? ''

  const count = useLiveQuery(
    async () => {
      if (!userId) return 0
      return db.syncQueue
        .where({ userId, status: 'pending' })
        .count()
    },
    [userId],
    0
  )

  return count
}

/**
 * Hook for getting storage usage statistics
 *
 * @returns Storage statistics
 */
export function useStorageStats() {
  const user = useAuthStore((state) => state.user)
  const userId = user?.id ?? ''

  const stats = useLiveQuery(
    async () => {
      if (!userId) {
        return {
          chaptersCount: 0,
          imagesCount: 0,
          totalSizeBytes: 0,
          booksCount: 0,
        }
      }

      const [chapters, images, books] = await Promise.all([
        db.chapters.filter((ch) => ch.userId === userId).toArray(),
        db.images.where('userId').equals(userId).toArray(),
        db.offlineBooks.where('userId').equals(userId).count(),
      ])

      // Calculate sizes
      const chaptersSize = chapters.reduce(
        (sum, ch) => sum + new Blob([ch.content]).size,
        0
      )
      const imagesSize = images.reduce((sum, img) => sum + img.size, 0)

      return {
        chaptersCount: chapters.length,
        imagesCount: images.length,
        totalSizeBytes: chaptersSize + imagesSize,
        booksCount: books,
      }
    },
    [userId],
    {
      chaptersCount: 0,
      imagesCount: 0,
      totalSizeBytes: 0,
      booksCount: 0,
    }
  )

  return stats
}

export default useOfflineBook
