/**
 * IndexedDB Image Cache Service
 *
 * Provides offline caching for generated images.
 * Images are stored as blobs in IndexedDB for fast retrieval
 * and offline access.
 *
 * Features:
 * - Store images by description ID
 * - Automatic cache expiration (7 days default)
 * - Cache size management
 * - Fallback to URL if cache miss
 *
 * @module services/imageCache
 */

const DB_NAME = 'BookReaderImageCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const CACHE_EXPIRATION_DAYS = 7;
const MAX_CACHE_SIZE_MB = 100; // Maximum cache size in MB

interface CachedImage {
  id: string; // description_id
  blob: Blob;
  url: string; // Original URL for fallback
  mimeType: string;
  size: number; // Size in bytes
  cachedAt: number; // Timestamp
  bookId: string;
  descriptionId: string;
}

interface CacheStats {
  totalImages: number;
  totalSizeBytes: number;
  oldestCacheDate: Date | null;
  newestCacheDate: Date | null;
}

class ImageCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize IndexedDB connection
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [ImageCache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [ImageCache] IndexedDB connected');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create images store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Indexes for querying
          store.createIndex('bookId', 'bookId', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('descriptionId', 'descriptionId', { unique: true });

          console.log('✅ [ImageCache] IndexedDB store created');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if image is cached
   */
  async has(descriptionId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('descriptionId');
        const request = index.get(descriptionId);

        request.onsuccess = () => {
          const cached = request.result as CachedImage | undefined;
          if (cached) {
            // Check expiration
            const isExpired = this.isExpired(cached.cachedAt);
            resolve(!isExpired);
          } else {
            resolve(false);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ImageCache] Error checking cache:', request.error);
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] IndexedDB not available:', err);
      return false;
    }
  }

  /**
   * Get cached image as object URL
   * Returns null if not cached or expired
   */
  async get(descriptionId: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('descriptionId');
        const request = index.get(descriptionId);

        request.onsuccess = () => {
          const cached = request.result as CachedImage | undefined;
          if (cached) {
            // Check expiration
            if (this.isExpired(cached.cachedAt)) {
              console.log('⏰ [ImageCache] Cache expired for:', descriptionId);
              // Delete expired entry asynchronously
              this.delete(descriptionId).catch(() => {});
              resolve(null);
            } else {
              // Create object URL from blob
              const objectUrl = URL.createObjectURL(cached.blob);
              console.log('✅ [ImageCache] Cache hit for:', descriptionId);
              resolve(objectUrl);
            }
          } else {
            console.log('⬜ [ImageCache] Cache miss for:', descriptionId);
            resolve(null);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ImageCache] Error reading cache:', request.error);
          resolve(null);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] IndexedDB not available:', err);
      return null;
    }
  }

  /**
   * Store image in cache
   * Downloads the image from URL and stores as blob
   */
  async set(
    descriptionId: string,
    imageUrl: string,
    bookId: string
  ): Promise<boolean> {
    try {
      // Download image as blob
      console.log('📥 [ImageCache] Downloading image for caching:', descriptionId);
      const response = await fetch(imageUrl);

      if (!response.ok) {
        console.warn('⚠️ [ImageCache] Failed to download image:', response.status);
        return false;
      }

      const blob = await response.blob();
      const mimeType = blob.type || 'image/png';

      // Check cache size before adding
      await this.ensureCacheSize(blob.size);

      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const cachedImage: CachedImage = {
          id: `${bookId}_${descriptionId}`,
          blob,
          url: imageUrl,
          mimeType,
          size: blob.size,
          cachedAt: Date.now(),
          bookId,
          descriptionId,
        };

        const request = store.put(cachedImage);

        request.onsuccess = () => {
          console.log('✅ [ImageCache] Image cached:', {
            descriptionId,
            size: (blob.size / 1024).toFixed(1) + 'KB',
          });
          resolve(true);
        };

        request.onerror = () => {
          console.warn('⚠️ [ImageCache] Error caching image:', request.error);
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] Error caching image:', err);
      return false;
    }
  }

  /**
   * Delete cached image
   */
  async delete(descriptionId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('descriptionId');

        // First find the record by descriptionId
        const getRequest = index.get(descriptionId);

        getRequest.onsuccess = () => {
          const cached = getRequest.result as CachedImage | undefined;
          if (cached) {
            const deleteRequest = store.delete(cached.id);
            deleteRequest.onsuccess = () => {
              console.log('🗑️ [ImageCache] Deleted:', descriptionId);
              resolve(true);
            };
            deleteRequest.onerror = () => resolve(false);
          } else {
            resolve(false);
          }
        };

        getRequest.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] Error deleting:', err);
      return false;
    }
  }

  /**
   * Clear all cached images for a book
   */
  async clearBook(bookId: string): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('bookId');
        const request = index.openCursor(IDBKeyRange.only(bookId));
        let deletedCount = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log('🗑️ [ImageCache] Cleared book cache:', bookId, deletedCount);
            resolve(deletedCount);
          }
        };

        request.onerror = () => resolve(deletedCount);
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] Error clearing book cache:', err);
      return 0;
    }
  }

  /**
   * Clear all expired entries
   */
  async clearExpired(): Promise<number> {
    try {
      const db = await this.getDB();
      const expirationTime = Date.now() - CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('cachedAt');
        const request = index.openCursor(IDBKeyRange.upperBound(expirationTime));
        let deletedCount = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log('🧹 [ImageCache] Cleared expired entries:', deletedCount);
            resolve(deletedCount);
          }
        };

        request.onerror = () => resolve(deletedCount);
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] Error clearing expired:', err);
      return 0;
    }
  }

  /**
   * Clear entire cache
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('🗑️ [ImageCache] All cache cleared');
          resolve();
        };

        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] Error clearing all:', err);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        const stats: CacheStats = {
          totalImages: 0,
          totalSizeBytes: 0,
          oldestCacheDate: null,
          newestCacheDate: null,
        };

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedImage;
            stats.totalImages++;
            stats.totalSizeBytes += cached.size;

            const cacheDate = new Date(cached.cachedAt);
            if (!stats.oldestCacheDate || cacheDate < stats.oldestCacheDate) {
              stats.oldestCacheDate = cacheDate;
            }
            if (!stats.newestCacheDate || cacheDate > stats.newestCacheDate) {
              stats.newestCacheDate = cacheDate;
            }

            cursor.continue();
          } else {
            console.log('📊 [ImageCache] Stats:', {
              images: stats.totalImages,
              size: (stats.totalSizeBytes / 1024 / 1024).toFixed(2) + 'MB',
            });
            resolve(stats);
          }
        };

        request.onerror = () =>
          resolve({
            totalImages: 0,
            totalSizeBytes: 0,
            oldestCacheDate: null,
            newestCacheDate: null,
          });
      });
    } catch (err) {
      return {
        totalImages: 0,
        totalSizeBytes: 0,
        oldestCacheDate: null,
        newestCacheDate: null,
      };
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(cachedAt: number): boolean {
    const expirationTime = CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - cachedAt > expirationTime;
  }

  /**
   * Ensure cache doesn't exceed size limit
   * Deletes oldest entries if necessary
   */
  private async ensureCacheSize(newEntrySize: number): Promise<void> {
    const stats = await this.getStats();
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

    if (stats.totalSizeBytes + newEntrySize > maxSizeBytes) {
      console.log('⚠️ [ImageCache] Cache size exceeded, cleaning oldest entries...');

      // Clear expired first
      await this.clearExpired();

      // If still over limit, delete oldest entries
      const newStats = await this.getStats();
      if (newStats.totalSizeBytes + newEntrySize > maxSizeBytes) {
        await this.deleteOldest(Math.ceil((newStats.totalSizeBytes + newEntrySize - maxSizeBytes) / (50 * 1024))); // Assume ~50KB per image
      }
    }
  }

  /**
   * Delete oldest N entries
   */
  private async deleteOldest(count: number): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('cachedAt');
        const request = index.openCursor();
        let deleted = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor && deleted < count) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            console.log('🧹 [ImageCache] Deleted oldest entries:', deleted);
            resolve();
          }
        };

        request.onerror = () => resolve();
      });
    } catch {
      // Ignore errors
    }
  }
}

// Singleton instance
export const imageCache = new ImageCacheService();

// Export types
export type { CachedImage, CacheStats };
