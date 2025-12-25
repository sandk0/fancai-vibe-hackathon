# 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: Service Worker Cache Not Cleared on Logout

**Дата:** 2025-12-24
**Приоритет:** 🔴 P0 - КРИТИЧНО
**Статус:** ⚠️ ТРЕБУЕТ НЕМЕДЛЕННОГО ИСПРАВЛЕНИЯ

---

## 🎯 Проблема

**Service Worker cache НЕ очищается при logout**, что создает уязвимость безопасности:

1. User A логинится, загружает книги
2. SW кэширует `/api/v1/books/{uuid}` на 1 час
3. User A делает logout
4. **SW cache НЕ очищается!** ❌
5. User B логинится на том же устройстве
6. User B может получить доступ к данным User A в offline режиме

---

## 🔍 Что найдено

### ✅ Работает правильно:
- Books list (`/api/v1/books`) **исключен** из SW кэша ✅
- TanStack Query cache очищается при logout ✅
- IndexedDB (chapterCache, imageCache) очищается ✅

### ❌ Критические проблемы:

1. **SW cache не очищается при logout**
   - Файл: `frontend/src/utils/cacheManager.ts`
   - Проблема: Нет вызова `caches.delete()`

2. **User-specific data кэшируется в SW**
   - `/api/v1/books/{uuid}` - кэшируется 1 час
   - `/api/v1/images/book/{uuid}` - кэшируется 30 дней
   - Нет user isolation в cache keys

3. **Backend не устанавливает Cache-Control headers**
   - API responses кэшируются SW без ограничений

---

## 🛠️ Решение

### Fix 1: Очистка SW cache при logout (СРОЧНО)

**Файл:** `frontend/src/utils/cacheManager.ts`

**Добавить:**

```typescript
export async function clearAllCaches(): Promise<ClearCacheResult> {
  // ... existing code ...

  // 5. Clear Service Worker caches
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('[CacheManager] Found SW caches:', cacheNames);

      await Promise.all(cacheNames.map(name => caches.delete(name)));

      result.serviceWorkerCacheCleared = true;
      console.log('✅ [CacheManager] Service Worker caches cleared');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Service Worker cache: ${message}`);
    console.error('❌ [CacheManager] Failed to clear SW caches:', error);
  }

  return result;
}
```

**Update interface:**

```typescript
interface ClearCacheResult {
  success: boolean;
  tanstackCleared: boolean;
  chapterCacheCleared: boolean;
  imageCacheCleared: boolean;
  readerStoreCleared: boolean;
  serviceWorkerCacheCleared: boolean; // ADD THIS
  errors: string[];
}
```

---

### Fix 2: Исключить user data из SW кэша

**Файл:** `frontend/public/sw.js`

**Изменить:**

```javascript
// BEFORE (строки 20-26):
const API_CACHE_PATTERNS = [
  /\/api\/v1\/books\/[a-f0-9-]+$/,  // ❌ REMOVE
  /\/api\/v1\/books\/[a-f0-9-]+\/chapters\/\d+$/,  // ❌ REMOVE
  /\/api\/v1\/images\/book\/[a-f0-9-]+$/,  // ❌ REMOVE
];

// AFTER:
const API_CACHE_PATTERNS = [
  // Empty - TanStack Query + IndexedDB handle API caching
];

// Add to NO_CACHE list:
const API_NO_CACHE_PATTERNS = [
  /\/api\/v1\/books$/,
  /\/api\/v1\/books\?/,
  /\/api\/v1\/books\/[a-f0-9-]+$/,  // ✅ ADD
  /\/api\/v1\/books\/[a-f0-9-]+\/chapters\//,  // ✅ ADD
  /\/api\/v1\/images\//,  // ✅ ADD
  /\/api\/v1\/auth\//,
  /\/api\/v1\/admin\//,
];

// Update version:
const CACHE_NAME = 'bookreader-ai-v1.2.0'; // Was v1.1.0
```

---

## 📋 Testing

После исправления проверить:

```javascript
// 1. Login
await login('test@example.com', 'password');

// 2. Check cache exists
const cachesBefore = await caches.keys();
console.log('Caches before logout:', cachesBefore);

// 3. Logout
await logout();

// 4. Verify cache cleared
const cachesAfter = await caches.keys();
console.log('Caches after logout:', cachesAfter); // Should be []

if (cachesAfter.length === 0) {
  console.log('✅ SW cache cleared successfully!');
} else {
  console.error('❌ SW cache NOT cleared!', cachesAfter);
}
```

---

## ⏱️ Timeline

**Immediate (сегодня):**
- [ ] Implement Fix 1 (SW cache clearing) - 30 min
- [ ] Test locally - 15 min
- [ ] Deploy to production - 15 min

**This week:**
- [ ] Implement Fix 2 (exclude user data from SW) - 30 min
- [ ] Update SW version to 1.2.0 - 5 min
- [ ] Test offline mode - 30 min
- [ ] Deploy - 15 min

**Total time:** ~2.5 hours

---

## 📊 Impact

**Security:**
- ✅ Prevents user data leakage between sessions
- ✅ Ensures fresh data after logout/login

**Performance:**
- ⚠️ Offline mode still works (via IndexedDB)
- ✅ No negative impact on UX

**Risk:**
- 🟢 Low - Additive changes only
- 🟢 TanStack Query + IndexedDB already handle caching

---

## 📁 Files to Modify

1. **frontend/src/utils/cacheManager.ts** - Add SW cache clearing
2. **frontend/public/sw.js** - Exclude user data from caching
3. **frontend/src/utils/cacheManager.ts** - Update `ClearCacheResult` interface

---

## 🔗 Related Documents

- **Full Report:** `/docs/reports/SERVICE_WORKER_DEEP_ANALYSIS_2025_12_24.md`
- **Architecture:** `/docs/explanations/architecture/frontend-architecture.md`
- **API Docs:** `/docs/reference/api/caching-strategy.md`

---

**ДЕЙСТВИЯ ТРЕБУЮТСЯ НЕМЕДЛЕННО**

Проверьте детальный отчет: `docs/reports/SERVICE_WORKER_DEEP_ANALYSIS_2025_12_24.md`
