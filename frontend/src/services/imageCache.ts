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
const DB_VERSION = 2; // Incremented for userId migration
const STORE_NAME = 'images';
const CACHE_EXPIRATION_DAYS = 7;
const MAX_CACHE_SIZE_MB = 100; // Maximum cache size in MB

interface CachedImage {
  id: string; // userId:descriptionId
  blob: Blob;
  url: string; // Original URL for fallback
  mimeType: string;
  size: number; // Size in bytes
  cachedAt: number; // Timestamp
  bookId: string;
  descriptionId: string;
  userId: string; // NEW: для изоляции данных между пользователями
}

interface CacheStats {
  totalImages: number;
  totalSizeBytes: number;
  oldestCacheDate: Date | null;
  newestCacheDate: Date | null;
}

/**
 * Metadata for tracking Object URLs
 */
interface ObjectURLTracker {
  url: string;
  createdAt: number; // Timestamp for cleanup
}

class ImageCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Map для tracking созданных Object URLs
   * Key: descriptionId, Value: ObjectURLTracker
   */
  private objectURLs: Map<string, ObjectURLTracker> = new Map();

  /**
   * Interval ID для автоматической очистки
   */
  private cleanupIntervalId: number | null = null;

  /**
   * Максимальный возраст Object URL в миллисекундах (30 минут)
   */
  private readonly MAX_OBJECT_URL_AGE_MS = 30 * 60 * 1000;

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
        const oldVersion = event.oldVersion;

        // Create images store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Indexes for querying
          store.createIndex('bookId', 'bookId', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('descriptionId', 'descriptionId', { unique: false }); // Changed to non-unique
          store.createIndex('userId', 'userId', { unique: false }); // NEW: для фильтрации по пользователю

          console.log('✅ [ImageCache] IndexedDB store created');
        } else if (oldVersion < 2) {
          // Migration: удаляем старые данные без userId
          console.log('🔄 [ImageCache] Migrating to v2 (userId isolation)...');
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore(STORE_NAME);

          // Добавляем новый индекс userId если его нет
          if (!store.indexNames.contains('userId')) {
            store.createIndex('userId', 'userId', { unique: false });
          }

          // Очищаем старые записи без userId
          store.clear();
          console.log('✅ [ImageCache] Migration complete - old cache cleared');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if image is cached
   *
   * @param userId - User ID для изоляции данных
   * @param descriptionId - Description ID для поиска
   */
  async has(userId: string, descriptionId: string): Promise<boolean> {
    try {
      const db = await this.getDB();
      const cacheKey = this.getCacheKey(userId, descriptionId);

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(cacheKey);

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
   * Генерация ключа кэша с учётом userId
   *
   * @param userId - User ID
   * @param descriptionId - Description ID
   * @returns Ключ формата "userId:descriptionId"
   */
  private getCacheKey(userId: string, descriptionId: string): string {
    return `${userId}:${descriptionId}`;
  }

  /**
   * Get cached image as object URL
   * Returns null if not cached or expired
   *
   * ВАЖНО: Полученный URL необходимо освободить через release() когда он больше не нужен,
   * иначе будет memory leak!
   *
   * @param userId - User ID для изоляции данных
   * @param descriptionId - Description ID для поиска
   */
  async get(userId: string, descriptionId: string): Promise<string | null> {
    try {
      // Проверяем, есть ли уже созданный Object URL
      const existing = this.objectURLs.get(descriptionId);
      if (existing) {
        console.log('♻️ [ImageCache] Reusing existing Object URL for:', descriptionId);
        return existing.url;
      }

      const db = await this.getDB();
      const cacheKey = this.getCacheKey(userId, descriptionId);

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(cacheKey);

        request.onsuccess = () => {
          const cached = request.result as CachedImage | undefined;
          if (cached) {
            // Check expiration
            if (this.isExpired(cached.cachedAt)) {
              console.log('⏰ [ImageCache] Cache expired for:', descriptionId);
              // Delete expired entry asynchronously
              this.delete(userId, descriptionId).catch(() => {});
              resolve(null);
            } else {
              // Create object URL from blob
              const objectUrl = URL.createObjectURL(cached.blob);

              // Track Object URL для последующего освобождения
              this.objectURLs.set(descriptionId, {
                url: objectUrl,
                createdAt: Date.now(),
              });

              console.log('✅ [ImageCache] Cache hit for:', descriptionId, `(tracked: ${this.objectURLs.size} URLs)`);
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
   * Освобождает Object URL для указанного descriptionId
   * Должен вызываться когда изображение больше не нужно (например, при unmount компонента)
   *
   * @param descriptionId - ID описания для освобождения URL
   * @returns true если URL был освобождён, false если URL не найден
   */
  release(descriptionId: string): boolean {
    const tracker = this.objectURLs.get(descriptionId);
    if (tracker) {
      URL.revokeObjectURL(tracker.url);
      this.objectURLs.delete(descriptionId);
      console.log('🧹 [ImageCache] Released Object URL for:', descriptionId, `(tracked: ${this.objectURLs.size} URLs)`);
      return true;
    }
    return false;
  }

  /**
   * Освобождает несколько Object URLs
   *
   * @param descriptionIds - Массив ID описаний для освобождения
   * @returns Количество освобождённых URLs
   */
  releaseMany(descriptionIds: string[]): number {
    let releasedCount = 0;
    for (const id of descriptionIds) {
      if (this.release(id)) {
        releasedCount++;
      }
    }
    return releasedCount;
  }

  /**
   * Store image in cache
   * Downloads the image from URL and stores as blob
   *
   * @param userId - User ID для изоляции данных
   * @param descriptionId - Description ID
   * @param imageUrl - URL изображения для загрузки
   * @param bookId - Book ID для группировки
   */
  async set(
    userId: string,
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
      await this.ensureCacheSize(userId, blob.size);

      const db = await this.getDB();
      const cacheKey = this.getCacheKey(userId, descriptionId);

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const cachedImage: CachedImage = {
          id: cacheKey,
          blob,
          url: imageUrl,
          mimeType,
          size: blob.size,
          cachedAt: Date.now(),
          bookId,
          descriptionId,
          userId,
        };

        const request = store.put(cachedImage);

        request.onsuccess = () => {
          console.log('✅ [ImageCache] Image cached:', {
            userId,
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
   * Также освобождает соответствующий Object URL если он существует
   *
   * @param userId - User ID для изоляции данных
   * @param descriptionId - Description ID для удаления
   */
  async delete(userId: string, descriptionId: string): Promise<boolean> {
    try {
      // Освобождаем Object URL если он существует
      this.release(descriptionId);

      const db = await this.getDB();
      const cacheKey = this.getCacheKey(userId, descriptionId);

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const deleteRequest = store.delete(cacheKey);

        deleteRequest.onsuccess = () => {
          console.log('🗑️ [ImageCache] Deleted:', descriptionId);
          resolve(true);
        };

        deleteRequest.onerror = () => {
          console.warn('⚠️ [ImageCache] Error deleting:', deleteRequest.error);
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] Error deleting:', err);
      return false;
    }
  }

  /**
   * Clear all cached images for a book
   * Также освобождает все связанные Object URLs
   *
   * @param userId - User ID для изоляции данных
   * @param bookId - Book ID для очистки
   */
  async clearBook(userId: string, bookId: string): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('bookId');
        const request = index.openCursor(IDBKeyRange.only(bookId));
        let deletedCount = 0;
        const descriptionIds: string[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedImage;

            // Проверяем, что это изображение принадлежит текущему пользователю
            if (cached.userId === userId) {
              descriptionIds.push(cached.descriptionId);
              cursor.delete();
              deletedCount++;
            }

            cursor.continue();
          } else {
            // Освобождаем все Object URLs для этой книги
            if (descriptionIds.length > 0) {
              this.releaseMany(descriptionIds);
            }
            console.log('🗑️ [ImageCache] Cleared book cache:', {
              userId,
              bookId,
              deletedCount,
            });
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
   * Clear all expired entries for a specific user
   *
   * @param userId - User ID для очистки устаревших данных
   */
  async clearExpired(userId: string): Promise<number> {
    try {
      const db = await this.getDB();
      const expirationTime = Date.now() - CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('userId');
        const request = index.openCursor(IDBKeyRange.only(userId));
        let deletedCount = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedImage;
            if (cached.cachedAt < expirationTime) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            console.log('🧹 [ImageCache] Cleared expired entries:', {
              userId,
              deletedCount,
            });
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
   * Clear all cached images for a specific user
   * Очищает только данные указанного пользователя, не затрагивая других
   *
   * @param userId - User ID для очистки данных
   */
  async clearAll(userId: string): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('userId');
        const request = index.openCursor(IDBKeyRange.only(userId));
        let deletedCount = 0;
        const descriptionIds: string[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedImage;
            descriptionIds.push(cached.descriptionId);
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            // Освобождаем все Object URLs для этого пользователя
            if (descriptionIds.length > 0) {
              this.releaseMany(descriptionIds);
            }
            console.log('🗑️ [ImageCache] All cache cleared for user:', {
              userId,
              deletedCount,
            });
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ImageCache] Error clearing user cache:', request.error);
          resolve(deletedCount);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ImageCache] Error clearing all:', err);
      return 0;
    }
  }

  /**
   * Get cache statistics for a specific user
   *
   * @param userId - User ID для получения статистики (опционально, если не указан - для всех)
   */
  async getStats(userId?: string): Promise<CacheStats> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        let request: IDBRequest;
        if (userId) {
          const index = store.index('userId');
          request = index.openCursor(IDBKeyRange.only(userId));
        } else {
          request = store.openCursor();
        }

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
              userId: userId || 'all',
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
   * Ensure cache doesn't exceed size limit for a specific user
   * Deletes oldest entries if necessary
   *
   * @param userId - User ID для проверки размера кэша
   * @param newEntrySize - Размер нового элемента в байтах
   */
  private async ensureCacheSize(userId: string, newEntrySize: number): Promise<void> {
    const stats = await this.getStats(userId);
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;

    if (stats.totalSizeBytes + newEntrySize > maxSizeBytes) {
      console.log('⚠️ [ImageCache] Cache size exceeded, cleaning oldest entries...');

      // Clear expired first
      await this.clearExpired(userId);

      // If still over limit, delete oldest entries
      const newStats = await this.getStats(userId);
      if (newStats.totalSizeBytes + newEntrySize > maxSizeBytes) {
        await this.deleteOldest(userId, Math.ceil((newStats.totalSizeBytes + newEntrySize - maxSizeBytes) / (50 * 1024))); // Assume ~50KB per image
      }
    }
  }

  /**
   * Delete oldest N entries for a specific user
   *
   * @param userId - User ID для очистки старых записей
   * @param count - Количество записей для удаления
   */
  private async deleteOldest(userId: string, count: number): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('userId');
        const request = index.openCursor(IDBKeyRange.only(userId));

        // Собираем все записи пользователя с их датами
        const entries: Array<{ id: string; cachedAt: number }> = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedImage;
            entries.push({ id: cached.id, cachedAt: cached.cachedAt });
            cursor.continue();
          } else {
            // Сортируем по дате (старые первыми) и удаляем N самых старых
            entries.sort((a, b) => a.cachedAt - b.cachedAt);
            const toDelete = entries.slice(0, count);

            let deleted = 0;
            toDelete.forEach((entry) => {
              const deleteRequest = store.delete(entry.id);
              deleteRequest.onsuccess = () => {
                deleted++;
                if (deleted === toDelete.length) {
                  console.log('🧹 [ImageCache] Deleted oldest entries:', {
                    userId,
                    deleted,
                  });
                  resolve();
                }
              };
            });

            if (toDelete.length === 0) {
              resolve();
            }
          }
        };

        request.onerror = () => resolve();
      });
    } catch {
      // Ignore errors
    }
  }

  /**
   * Очистка старых Object URLs (старше MAX_OBJECT_URL_AGE_MS)
   * Автоматически вызывается каждые 5 минут
   *
   * @returns Количество освобождённых URLs
   */
  private cleanupStaleObjectURLs(): number {
    const now = Date.now();
    const staleIds: string[] = [];

    // Используем Array.from для совместимости с TypeScript target
    Array.from(this.objectURLs.entries()).forEach(([id, tracker]) => {
      if (now - tracker.createdAt > this.MAX_OBJECT_URL_AGE_MS) {
        staleIds.push(id);
      }
    });

    if (staleIds.length > 0) {
      console.log('🧹 [ImageCache] Cleaning up stale Object URLs:', staleIds.length);
      const released = this.releaseMany(staleIds);
      return released;
    }

    return 0;
  }

  /**
   * Запускает автоматическую очистку старых Object URLs каждые 5 минут
   * Автоматически вызывается при первом использовании сервиса
   */
  startAutoCleanup(): void {
    if (this.cleanupIntervalId !== null) {
      console.warn('⚠️ [ImageCache] Auto-cleanup already started');
      return;
    }

    // Запускаем очистку каждые 5 минут
    this.cleanupIntervalId = window.setInterval(() => {
      this.cleanupStaleObjectURLs();
    }, 5 * 60 * 1000);

    console.log('✅ [ImageCache] Auto-cleanup started (interval: 5 minutes)');
  }

  /**
   * Останавливает автоматическую очистку
   */
  stopAutoCleanup(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
      console.log('🛑 [ImageCache] Auto-cleanup stopped');
    }
  }

  /**
   * Полная очистка всех ресурсов
   * Должен вызываться при unmount приложения или компонента
   *
   * Освобождает:
   * - Все Object URLs
   * - Останавливает auto-cleanup interval
   * - Закрывает IndexedDB соединение
   */
  destroy(): void {
    console.log('🗑️ [ImageCache] Destroying service...');

    // Освобождаем все Object URLs
    const urlCount = this.objectURLs.size;
    Array.from(this.objectURLs.entries()).forEach(([, tracker]) => {
      URL.revokeObjectURL(tracker.url);
    });
    this.objectURLs.clear();

    // Останавливаем auto-cleanup
    this.stopAutoCleanup();

    // Закрываем IndexedDB соединение
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
    }

    console.log('✅ [ImageCache] Service destroyed', {
      releasedURLs: urlCount,
    });
  }

  /**
   * Получить количество активных Object URLs
   */
  getActiveURLCount(): number {
    return this.objectURLs.size;
  }
}

// Singleton instance
export const imageCache = new ImageCacheService();

// Автоматически запускаем очистку при инициализации
imageCache.startAutoCleanup();

// Export types
export type { CachedImage, CacheStats, ObjectURLTracker };
