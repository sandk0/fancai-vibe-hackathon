# Чеклист исправлений безопасности кэшей

## 📁 Файлы для изменения

### 1. `frontend/src/services/chapterCache.ts`

**Строки для изменения:**

#### Строка 24-32: Добавить userId в interface
```typescript
// ❌ BEFORE:
interface CachedChapter {
  id: string; // Composite key: `${bookId}_${chapterNumber}`
  bookId: string;
  chapterNumber: number;
  descriptions: Description[];
  images: GeneratedImage[];
  cachedAt: number;
  lastAccessedAt: number;
}

// ✅ AFTER:
interface CachedChapter {
  id: string; // Composite key: `${userId}_${bookId}_${chapterNumber}`
  userId: string; // NEW!
  bookId: string;
  chapterNumber: number;
  descriptions: Description[];
  images: GeneratedImage[];
  cachedAt: number;
  lastAccessedAt: number;
}
```

#### Строка 19: Increment DB_VERSION
```typescript
// ❌ BEFORE:
const DB_VERSION = 1;

// ✅ AFTER:
const DB_VERSION = 2; // User isolation migration
```

#### Строка 66-82: Обновить индексы
```typescript
// ✅ ADD после строки 78:
store.createIndex('userId', 'userId', { unique: false });
store.createIndex('userBook', ['userId', 'bookId'], { unique: false });
// MODIFY строку 78:
store.createIndex('userBookChapter', ['userId', 'bookId', 'chapterNumber'], { unique: true });
```

#### Строка 183-229: Обновить методы с userId параметром
```typescript
// Добавить userId параметр во все методы:
async set(userId: string, bookId: string, chapterNumber: number, ...)
async get(userId: string, bookId: string, chapterNumber: number)
async delete(userId: string, bookId: string, chapterNumber: number)
async clearBook(userId: string, bookId: string) // NEW - clear only user's book data
```

#### Строка 199-206: Обновить ключ
```typescript
// ❌ BEFORE:
const cachedChapter: CachedChapter = {
  id: `${bookId}_${chapterNumber}`,
  bookId,
  chapterNumber,
  descriptions,
  images,
  cachedAt: Date.now(),
  lastAccessedAt: Date.now(),
};

// ✅ AFTER:
const cachedChapter: CachedChapter = {
  id: `${userId}_${bookId}_${chapterNumber}`,
  userId, // NEW!
  bookId,
  chapterNumber,
  descriptions,
  images,
  cachedAt: Date.now(),
  lastAccessedAt: Date.now(),
};
```

#### Добавить новый метод clearUserData
```typescript
/**
 * Очистка всех данных конкретного пользователя
 * Вызывается при logout для изоляции данных
 */
async clearUserData(userId: string): Promise<number> {
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
          console.log('🗑️ [ChapterCache] Cleared user data:', userId, deletedCount);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.warn('⚠️ [ChapterCache] Error clearing user data:', request.error);
        resolve(deletedCount);
      };
    });
  } catch (err) {
    console.warn('⚠️ [ChapterCache] Error clearing user data:', err);
    return 0;
  }
}
```

---

### 2. `frontend/src/services/imageCache.ts`

**Аналогичные изменения:**

#### Строка 23-32: Добавить userId
```typescript
interface CachedImage {
  id: string; // `${userId}_${bookId}_${descriptionId}`
  userId: string; // NEW!
  blob: Blob;
  url: string;
  mimeType: string;
  size: number;
  cachedAt: number;
  bookId: string;
  descriptionId: string;
}
```

#### Строка 18: Increment DB_VERSION
```typescript
const DB_VERSION = 2; // User isolation migration
```

#### Строка 90-104: Обновить индексы
```typescript
store.createIndex('userId', 'userId', { unique: false });
store.createIndex('userBook', ['userId', 'bookId'], { unique: false });
store.createIndex('descriptionId', 'descriptionId', { unique: false });
```

#### Обновить методы с userId
```typescript
async set(userId: string, descriptionId: string, imageUrl: string, bookId: string)
async get(userId: string, descriptionId: string)
async delete(userId: string, descriptionId: string)
async clearBook(userId: string, bookId: string)
async clearUserData(userId: string) // NEW
```

#### Строка 270-279: Обновить ключ
```typescript
const cachedImage: CachedImage = {
  id: `${userId}_${bookId}_${descriptionId}`, // UPDATED
  userId, // NEW!
  blob,
  url: imageUrl,
  mimeType,
  size: blob.size,
  cachedAt: Date.now(),
  bookId,
  descriptionId,
};
```

---

### 3. `frontend/src/hooks/epub/useLocationGeneration.ts`

#### Строка 31-33: Обновить DB constants
```typescript
const DB_NAME = 'BookReaderAI';
const DB_VERSION = 2; // User isolation migration
const STORE_NAME = 'epub_locations';
```

#### Строка 43-48: Обновить keyPath
```typescript
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    // ✅ UPDATED: Composite key [userId, bookId]
    const store = db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'bookId'] });
    store.createIndex('userId', 'userId', { unique: false });
  }
};
```

#### Строка 52-69: Обновить getCachedLocations
```typescript
const getCachedLocations = async (userId: string, bookId: string): Promise<any | null> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get([userId, bookId]); // UPDATED: composite key

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
```

#### Строка 72-89: Обновить cacheLocations
```typescript
const cacheLocations = async (userId: string, bookId: string, locations: any): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        userId, // NEW!
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
```

#### Добавить clearUserLocations
```typescript
/**
 * Очистка всех EPUB locations для конкретного пользователя
 */
export const clearUserLocations = async (userId: string): Promise<void> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userId');
      const request = index.openCursor(IDBKeyRange.only(userId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          console.log('✅ [clearUserLocations] Cleared locations for user:', userId);
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('⚠️ [clearUserLocations] Could not clear locations:', err);
  }
};
```

---

### 4. `frontend/src/utils/cacheManager.ts`

#### Строка 42-108: Обновить clearAllCaches с userId
```typescript
/**
 * Clear all application caches for specific user
 *
 * @param userId - User ID to clear caches for (for isolation)
 * @returns ClearCacheResult with status of each cache clearing operation
 */
export async function clearAllCaches(userId?: string): Promise<ClearCacheResult> {
  console.log('🧹 [CacheManager] Clearing all caches for user:', userId);

  const result: ClearCacheResult = {
    success: true,
    tanstackCleared: false,
    chapterCacheCleared: false,
    imageCacheCleared: false,
    readerStoreCleared: false,
    epubLocationsCleared: false, // NEW!
    pendingSessionsCleared: false, // NEW!
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

  // 2. Clear IndexedDB chapter cache (with user isolation)
  try {
    if (userId) {
      await chapterCache.clearUserData(userId);
    } else {
      await chapterCache.clearAll(); // Fallback for backward compatibility
    }
    result.chapterCacheCleared = true;
    console.log('✅ [CacheManager] Chapter cache cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Chapter cache: ${message}`);
    console.error('❌ [CacheManager] Failed to clear chapter cache:', error);
  }

  // 3. Clear IndexedDB image cache (with user isolation)
  try {
    if (userId) {
      await imageCache.clearUserData(userId);
    } else {
      await imageCache.clearAll();
    }
    result.imageCacheCleared = true;
    console.log('✅ [CacheManager] Image cache cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Image cache: ${message}`);
    console.error('❌ [CacheManager] Failed to clear image cache:', error);
  }

  // 4. Clear EPUB locations (NEW!)
  try {
    if (userId) {
      await clearUserLocations(userId);
    } else {
      // Clear all if no userId (backward compatibility)
      await clearAllEpubLocations();
    }
    result.epubLocationsCleared = true;
    console.log('✅ [CacheManager] EPUB locations cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`EPUB locations: ${message}`);
    console.error('❌ [CacheManager] Failed to clear EPUB locations:', error);
  }

  // 5. Clear pending reading sessions (NEW!)
  try {
    if (userId) {
      localStorage.removeItem(`bookreader_pending_sessions_${userId}`);
    } else {
      localStorage.removeItem('bookreader_pending_sessions');
    }
    result.pendingSessionsCleared = true;
    console.log('✅ [CacheManager] Pending sessions cleared');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Pending sessions: ${message}`);
    console.error('❌ [CacheManager] Failed to clear pending sessions:', error);
  }

  // 6. Reset reader store state
  try {
    useReaderStore.getState().reset(userId);
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
    console.log('✅ [CacheManager] All caches cleared successfully for user:', userId);
  } else {
    console.warn('⚠️ [CacheManager] Some caches failed to clear:', result.errors);
  }

  return result;
}
```

#### Добавить импорты
```typescript
import { clearUserLocations } from '@/hooks/epub/useLocationGeneration';
```

---

### 5. `frontend/src/stores/auth.ts`

#### Строка 27-28, 61-62: Передать userId в clearAllCaches
```typescript
// В login (строка 27):
const userId = user.id;
await clearAllCaches(userId); // Pass userId

// В register (строка 61):
const userId = user.id;
await clearAllCaches(userId); // Pass userId

// В logout (строка 89-107):
logout: async () => {
  console.log('🚪 Logging out...');
  const userId = get().user?.id; // Capture userId BEFORE clearing state

  // Call logout API
  authAPI.logout().catch(console.error);

  // Clear localStorage
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);

  // CRITICAL: Clear all caches with userId for isolation
  console.log('🧹 Clearing all caches on logout for user:', userId);
  try {
    const result = await clearAllCaches(userId); // Pass userId!
    if (result.success) {
      console.log('✅ All caches cleared on logout');
    } else {
      console.error('⚠️ Some caches failed to clear:', result.errors);
    }
  } catch (error) {
    console.error('❌ Failed to clear some caches on logout:', error);
  }

  // Reset state
  set({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
},
```

---

### 6. `frontend/src/stores/reader.ts`

#### Строка 202-222: Обновить reset с userId
```typescript
// Full reset - clears all data (for logout)
reset: (userId?: string) => {
  console.log('🧹 [ReaderStore] Resetting all data for user:', userId);
  set({
    // Reset settings to defaults
    fontSize: 18,
    fontFamily: 'Georgia, serif',
    lineHeight: 1.6,
    theme: 'light',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    maxWidth: 800,
    margin: 40,
    // Clear all user data
    readingProgress: {},
    bookmarks: {},
    highlights: {},
  });

  // Clear persisted storage with userId
  if (userId) {
    localStorage.removeItem(`reader-storage-${userId}`);
  } else {
    // Backward compatibility
    localStorage.removeItem('reader-storage');
  }
},
```

---

### 7. `frontend/src/api/readingSessions.ts`

#### Строка 226, 291, 302, 315: Обновить ключ с userId
```typescript
// Строка 226: Обновить PENDING_SESSIONS_KEY function
const getPendingSessionsKey = (userId?: string): string => {
  return userId
    ? `bookreader_pending_sessions_${userId}`
    : 'bookreader_pending_sessions';
};

// Строка 284-292: Обновить savePendingSession
function savePendingSession(type: 'start' | 'update' | 'end', data: any, userId?: string) {
  try {
    const key = getPendingSessionsKey(userId);
    const pending = getPendingSessions(userId);
    pending.push({
      type,
      data,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(pending));
  } catch (error) {
    console.error('❌ [ReadingSessions] Failed to save pending session:', error);
  }
}

// Строка 299-306: Обновить getPendingSessions
function getPendingSessions(userId?: string): PendingSession[] {
  try {
    const key = getPendingSessionsKey(userId);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('❌ [ReadingSessions] Failed to get pending sessions:', error);
    return [];
  }
}

// Строка 312-319: Обновить clearPendingSessions
function clearPendingSessions(userId?: string): void {
  try {
    const key = getPendingSessionsKey(userId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('❌ [ReadingSessions] Failed to clear pending sessions:', error);
  }
}
```

---

## 🧪 ТЕСТЫ

### Создать `frontend/src/services/__tests__/cacheIsolation.test.ts`

```typescript
import { chapterCache } from '../chapterCache';
import { imageCache } from '../imageCache';

describe('Cache User Isolation', () => {
  const userA = 'alice';
  const userB = 'bob';
  const bookId = 'book-123';

  beforeEach(async () => {
    // Clear all caches before each test
    await chapterCache.clearAll();
    await imageCache.clearAll();
  });

  it('should isolate chapter cache by userId', async () => {
    // User A caches a chapter
    await chapterCache.set(userA, bookId, 1, [], []);

    // User B should NOT see User A's cache
    const cachedB = await chapterCache.get(userB, bookId, 1);
    expect(cachedB).toBeNull();

    // User A should see their own cache
    const cachedA = await chapterCache.get(userA, bookId, 1);
    expect(cachedA).not.toBeNull();
  });

  it('should isolate image cache by userId', async () => {
    const descId = 'desc-1';
    const imageUrl = 'https://example.com/image.jpg';

    // User A caches an image
    await imageCache.set(userA, descId, imageUrl, bookId);

    // User B should NOT see User A's cache
    const cachedB = await imageCache.get(userB, descId);
    expect(cachedB).toBeNull();

    // User A should see their own cache
    const cachedA = await imageCache.get(userA, descId);
    expect(cachedA).not.toBeNull();
  });

  it('should clear only specific user data on logout', async () => {
    // Both users cache data
    await chapterCache.set(userA, bookId, 1, [], []);
    await chapterCache.set(userB, bookId, 1, [], []);

    // User A logs out
    await chapterCache.clearUserData(userA);

    // User A's data should be cleared
    const cachedA = await chapterCache.get(userA, bookId, 1);
    expect(cachedA).toBeNull();

    // User B's data should remain
    const cachedB = await chapterCache.get(userB, bookId, 1);
    expect(cachedB).not.toBeNull();
  });
});
```

---

## ✅ ПРОВЕРКА ПОСЛЕ ИСПРАВЛЕНИЯ

```bash
# 1. Проверить что все ключи содержат userId
grep -r "CachedChapter\|CachedImage" frontend/src/services/ | grep "userId"

# 2. Проверить DB_VERSION incremented
grep "DB_VERSION = " frontend/src/services/*.ts

# 3. Запустить тесты
npm run test -- cacheIsolation.test.ts

# 4. Проверить clearAllCaches с userId
grep "clearAllCaches" frontend/src/ -r

# 5. Build check
npm run build
```

---

**Итого файлов для изменения:** 7
**Новых тестов:** 1
**Estimated time:** 4-6 часов
**Критичность:** 🔴 КРИТИЧНО
