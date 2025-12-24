/**
 * IndexedDB Chapter Cache Service
 *
 * Кэширует загруженные главы книг для уменьшения запросов к API
 * и ускорения навигации по книге.
 *
 * Особенности:
 * - Хранение глав в IndexedDB (descriptions + images)
 * - TTL (Time To Live) - 7 дней по умолчанию
 * - LRU (Least Recently Used) cleanup при превышении лимита
 * - Инвалидация при обновлении книги
 *
 * @module services/chapterCache
 */

import type { Description, GeneratedImage } from '@/types/api';

const DB_NAME = 'BookReaderChapterCache';
const DB_VERSION = 1;
const STORE_NAME = 'chapters';
const CACHE_EXPIRATION_DAYS = 7;
const MAX_CHAPTERS_PER_BOOK = 50; // Максимум глав одной книги в кэше

interface CachedChapter {
  id: string; // Composite key: `${userId}:${bookId}:${chapterNumber}`
  userId: string; // User ID для изоляции данных
  bookId: string;
  chapterNumber: number;
  descriptions: Description[];
  images: GeneratedImage[];
  cachedAt: number; // Timestamp
  lastAccessedAt: number; // Для LRU
}

interface CacheStats {
  totalChapters: number;
  chaptersByBook: Record<string, number>;
  oldestCacheDate: Date | null;
  newestCacheDate: Date | null;
}

class ChapterCacheService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Инициализация IndexedDB
   */
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('❌ [ChapterCache] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [ChapterCache] IndexedDB connected');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Создаём store для глав
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Индексы для быстрого поиска с изоляцией по userId
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('bookId', 'bookId', { unique: false });
          store.createIndex('chapterNumber', 'chapterNumber', { unique: false });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          store.createIndex('userBookChapter', ['userId', 'bookId', 'chapterNumber'], { unique: true });

          console.log('✅ [ChapterCache] IndexedDB store created');
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * Проверка наличия главы в кэше
   */
  async has(userId: string, bookId: string, chapterNumber: number): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('userBookChapter');
        const request = index.get([userId, bookId, chapterNumber]);

        request.onsuccess = () => {
          const cached = request.result as CachedChapter | undefined;
          if (cached) {
            // Проверка на истечение срока
            const isExpired = this.isExpired(cached.cachedAt);
            resolve(!isExpired);
          } else {
            resolve(false);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error checking cache:', request.error);
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] IndexedDB not available:', err);
      return false;
    }
  }

  /**
   * Получение главы из кэша
   */
  async get(
    userId: string,
    bookId: string,
    chapterNumber: number
  ): Promise<{ descriptions: Description[]; images: GeneratedImage[] } | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('userBookChapter');
        const request = index.get([userId, bookId, chapterNumber]);

        request.onsuccess = () => {
          const cached = request.result as CachedChapter | undefined;
          if (cached) {
            // Проверка на истечение срока
            if (this.isExpired(cached.cachedAt)) {
              console.log('⏰ [ChapterCache] Cache expired for:', { userId, bookId, chapterNumber });
              // Удаляем устаревшую запись
              this.delete(userId, bookId, chapterNumber).catch(() => {});
              resolve(null);
            } else {
              // Обновляем lastAccessedAt для LRU
              cached.lastAccessedAt = Date.now();
              store.put(cached);

              console.log('✅ [ChapterCache] Cache hit for:', {
                userId,
                bookId,
                chapterNumber,
                descriptionsCount: cached.descriptions.length,
                imagesCount: cached.images.length,
              });

              resolve({
                descriptions: cached.descriptions,
                images: cached.images,
              });
            }
          } else {
            console.log('⬜ [ChapterCache] Cache miss for:', { userId, bookId, chapterNumber });
            resolve(null);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error reading cache:', request.error);
          resolve(null);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] IndexedDB not available:', err);
      return null;
    }
  }

  /**
   * Сохранение главы в кэш
   */
  async set(
    userId: string,
    bookId: string,
    chapterNumber: number,
    descriptions: Description[],
    images: GeneratedImage[]
  ): Promise<boolean> {
    try {
      // Проверка лимита глав для книги
      await this.ensureBookLimit(userId, bookId);

      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const cachedChapter: CachedChapter = {
          id: `${userId}:${bookId}:${chapterNumber}`,
          userId,
          bookId,
          chapterNumber,
          descriptions,
          images,
          cachedAt: Date.now(),
          lastAccessedAt: Date.now(),
        };

        const request = store.put(cachedChapter);

        request.onsuccess = () => {
          console.log('✅ [ChapterCache] Chapter cached:', {
            userId,
            bookId,
            chapterNumber,
            descriptionsCount: descriptions.length,
            imagesCount: images.length,
          });
          resolve(true);
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error caching chapter:', request.error);
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error caching chapter:', err);
      return false;
    }
  }

  /**
   * Удаление главы из кэша
   */
  async delete(userId: string, bookId: string, chapterNumber: number): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const id = `${userId}:${bookId}:${chapterNumber}`;
        const request = store.delete(id);

        request.onsuccess = () => {
          console.log('🗑️ [ChapterCache] Deleted:', { userId, bookId, chapterNumber });
          resolve(true);
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error deleting:', request.error);
          resolve(false);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error deleting:', err);
      return false;
    }
  }

  /**
   * Очистка всех глав книги (при обновлении/удалении)
   */
  async clearBook(userId: string, bookId: string): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        let deletedCount = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedChapter;
            // Удаляем только записи конкретного пользователя и книги
            if (cached.userId === userId && cached.bookId === bookId) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            console.log('🗑️ [ChapterCache] Cleared book cache:', { userId, bookId, deletedCount });
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error clearing book cache:', request.error);
          resolve(deletedCount);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error clearing book cache:', err);
      return 0;
    }
  }

  /**
   * Очистка устаревших записей
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
            console.log('🧹 [ChapterCache] Cleared expired entries:', deletedCount);
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error clearing expired:', request.error);
          resolve(deletedCount);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error clearing expired:', err);
      return 0;
    }
  }

  /**
   * Полная очистка кэша конкретного пользователя
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

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            console.log('🗑️ [ChapterCache] All cache cleared for user:', { userId, deletedCount });
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error clearing all:', request.error);
          resolve(deletedCount);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error clearing all:', err);
      return 0;
    }
  }

  /**
   * Получение статистики кэша
   */
  async getStats(): Promise<CacheStats> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        const stats: CacheStats = {
          totalChapters: 0,
          chaptersByBook: {},
          oldestCacheDate: null,
          newestCacheDate: null,
        };

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedChapter;
            stats.totalChapters++;

            // Подсчёт глав по книгам
            if (!stats.chaptersByBook[cached.bookId]) {
              stats.chaptersByBook[cached.bookId] = 0;
            }
            stats.chaptersByBook[cached.bookId]++;

            // Даты
            const cacheDate = new Date(cached.cachedAt);
            if (!stats.oldestCacheDate || cacheDate < stats.oldestCacheDate) {
              stats.oldestCacheDate = cacheDate;
            }
            if (!stats.newestCacheDate || cacheDate > stats.newestCacheDate) {
              stats.newestCacheDate = cacheDate;
            }

            cursor.continue();
          } else {
            console.log('📊 [ChapterCache] Stats:', {
              totalChapters: stats.totalChapters,
              booksCount: Object.keys(stats.chaptersByBook).length,
            });
            resolve(stats);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error getting stats:', request.error);
          resolve({
            totalChapters: 0,
            chaptersByBook: {},
            oldestCacheDate: null,
            newestCacheDate: null,
          });
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error getting stats:', err);
      return {
        totalChapters: 0,
        chaptersByBook: {},
        oldestCacheDate: null,
        newestCacheDate: null,
      };
    }
  }

  /**
   * Проверка истечения срока
   */
  private isExpired(cachedAt: number): boolean {
    const expirationTime = CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - cachedAt > expirationTime;
  }

  /**
   * Контроль количества глав на книгу (LRU cleanup)
   */
  private async ensureBookLimit(userId: string, bookId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        const chapters: CachedChapter[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedChapter;
            // Собираем только главы конкретного пользователя и книги
            if (cached.userId === userId && cached.bookId === bookId) {
              chapters.push(cached);
            }
            cursor.continue();
          } else {
            // Если превышен лимит - удаляем самые старые по lastAccessedAt
            if (chapters.length >= MAX_CHAPTERS_PER_BOOK) {
              console.log('⚠️ [ChapterCache] Book limit reached, applying LRU cleanup...');

              // Сортируем по lastAccessedAt (старые первыми)
              chapters.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

              // Удаляем старые записи
              const toDelete = chapters.slice(0, chapters.length - MAX_CHAPTERS_PER_BOOK + 1);
              const deleteTransaction = db.transaction(STORE_NAME, 'readwrite');
              const deleteStore = deleteTransaction.objectStore(STORE_NAME);

              toDelete.forEach((chapter) => {
                deleteStore.delete(chapter.id);
              });

              console.log('🧹 [ChapterCache] Deleted LRU entries:', toDelete.length);
            }
            resolve();
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error checking book limit:', request.error);
          resolve();
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error ensuring book limit:', err);
    }
  }

  /**
   * Очистка записей без userId (старый формат)
   * Вызывается автоматически при первом доступе для миграции
   */
  async clearLegacyData(): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        let deletedCount = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedChapter;
            // Удаляем записи без userId (старый формат)
            if (!cached.userId) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            if (deletedCount > 0) {
              console.log('🧹 [ChapterCache] Cleared legacy data without userId:', deletedCount);
            }
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error clearing legacy data:', request.error);
          resolve(deletedCount);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error clearing legacy data:', err);
      return 0;
    }
  }

  /**
   * Очистка записей с пустыми описаниями
   * (Нужно при миграции на on-demand extraction)
   */
  async clearEmptyDescriptions(): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        let deletedCount = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const cached = cursor.value as CachedChapter;
            // Удаляем записи с пустыми описаниями
            if (!cached.descriptions || cached.descriptions.length === 0) {
              cursor.delete();
              deletedCount++;
            }
            cursor.continue();
          } else {
            console.log('🧹 [ChapterCache] Cleared empty description entries:', deletedCount);
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('⚠️ [ChapterCache] Error clearing empty:', request.error);
          resolve(deletedCount);
        };
      });
    } catch (err) {
      console.warn('⚠️ [ChapterCache] Error clearing empty:', err);
      return 0;
    }
  }

  /**
   * Автоматическая очистка устаревших записей (вызывать периодически)
   */
  async performMaintenance(): Promise<void> {
    console.log('🔧 [ChapterCache] Performing maintenance...');
    await this.clearLegacyData(); // Очищаем старые данные без userId
    await this.clearExpired();
    await this.clearEmptyDescriptions(); // Также очищаем пустые записи
    const stats = await this.getStats();
    console.log('✅ [ChapterCache] Maintenance complete:', stats);
  }
}

// Singleton instance
export const chapterCache = new ChapterCacheService();

// Export types
export type { CachedChapter, CacheStats };
