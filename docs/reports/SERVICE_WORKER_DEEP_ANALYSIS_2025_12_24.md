# 🔍 КРИТИЧЕСКИЙ АНАЛИЗ: Service Worker Кэширование в BookReader AI

**Дата:** 2025-12-24
**Приоритет:** 🔴 КРИТИЧЕСКИЙ
**Статус:** ⚠️ УЯЗВИМОСТЬ НАЙДЕНА

---

## 📋 Executive Summary

**ПРОБЛЕМА:** Service Worker **НЕ очищается при logout**, что создает **критическую уязвимость безопасности**.

### Критические находки:

1. ✅ **Хорошо:** Books list (`/api/v1/books`) ИСКЛЮЧЕН из SW кэша (v1.1.0 fix)
2. ✅ **Хорошо:** TanStack Query + IndexedDB очищаются при logout
3. ❌ **КРИТИЧНО:** Service Worker cache **НЕ очищается** при logout
4. ❌ **КРИТИЧНО:** Specific book data (`/api/v1/books/{uuid}`) **КЭШИРУЕТСЯ** в SW на 1 час
5. ❌ **ПРОБЛЕМА:** Images кэшируются на 30 дней без user isolation

---

## 🔬 Детальный анализ

### 1. Service Worker Configuration

**Файл:** `/frontend/public/sw.js` (467 строк, v1.1.0)

#### Cache Names:
```javascript
const CACHE_NAME = 'bookreader-ai-v1.1.0';
const STATIC_CACHE_NAME = 'bookreader-static-v1.1.0';
const DYNAMIC_CACHE_NAME = 'bookreader-dynamic-v1.1.0';
const IMAGE_CACHE = 'bookreader-images-v1.0.0';
```

#### Cache Durations:
```javascript
const CACHE_DURATION = {
  static: 7 * 24 * 60 * 60 * 1000,  // 7 дней
  api: 60 * 60 * 1000,               // 1 час ⚠️
  images: 30 * 24 * 60 * 60 * 1000,  // 30 дней ⚠️
};
```

#### Cache Limits:
```javascript
const MAX_CACHE_SIZE = {
  static: 50,    // 50 entries
  dynamic: 100,  // 100 entries
  images: 200,   // 200 entries
};
```

---

### 2. API Caching Patterns

#### ✅ ИСКЛЮЧЕНЫ из кэша (правильно):
```javascript
const API_NO_CACHE_PATTERNS = [
  /\/api\/v1\/books$/,        // Books list ✅
  /\/api\/v1\/books\?/,       // Books list with params ✅
  /\/api\/v1\/auth\//,        // Auth endpoints ✅
  /\/api\/v1\/admin\//,       // Admin endpoints ✅
];
```

**Обработка:** Pass-through to network без кэширования (строка 125):
```javascript
} else if (isUncacheableAPIRequest(request)) {
  event.respondWith(fetch(request));
}
```

#### ⚠️ КЭШИРУЮТСЯ (потенциальная проблема):
```javascript
const API_CACHE_PATTERNS = [
  /\/api\/v1\/books\/[a-f0-9-]+$/,              // Specific book ⚠️
  /\/api\/v1\/books\/[a-f0-9-]+\/chapters\/\d+$/,  // Chapters ⚠️
  /\/api\/v1\/images\/book\/[a-f0-9-]+$/,       // Book images ⚠️
];
```

**Стратегия:** Network First with cache fallback (строки 204-260):
```javascript
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone()); // ⚠️ Кэшируется!
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request); // ⚠️ Fallback
    return cachedResponse;
  }
}
```

**ПРОБЛЕМА:** Если User A загрузил книгу, она кэшируется в `DYNAMIC_CACHE_NAME`. При logout SW cache **НЕ очищается**. User B может получить доступ к данным User A в offline режиме!

---

### 3. Image Caching

**Стратегия:** Cache First (приоритет кэша над сетью)

```javascript
async function handleImageRequest(request) {
  const cache = await caches.open('bookreader-images-v1.0.0');
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse; // ⚠️ Возвращаем из кэша БЕЗ проверки user
  }

  const networkResponse = await fetch(request);
  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone()); // ⚠️ Кэшируется на 30 дней
  }

  return networkResponse;
}
```

**ПРОБЛЕМА:** Images кэшируются без user ID в ключе. User B может видеть сгенерированные изображения User A.

---

### 4. Logout Cache Clearing Analysis

#### ✅ Что очищается (файл: `src/stores/auth.ts`):

```typescript
logout: async () => {
  // 1. Clear localStorage
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);

  // 2. Clear ALL application caches
  await clearAllCaches(); // ✅ Вызывается
}
```

#### Что включает `clearAllCaches()` (файл: `src/utils/cacheManager.ts`):

```typescript
export async function clearAllCaches(): Promise<ClearCacheResult> {
  // 1. TanStack Query cache
  queryClient.clear(); // ✅

  // 2. IndexedDB chapter cache
  await chapterCache.clearAll(); // ✅

  // 3. IndexedDB image cache
  await imageCache.clearAll(); // ✅

  // 4. Reader store state
  useReaderStore.getState().reset(); // ✅
}
```

#### ❌ Что НЕ очищается:

**Service Worker Cache Storage API caches:**
- `bookreader-static-v1.1.0` (7 дней)
- `bookreader-dynamic-v1.1.0` (1 час) ⚠️ **КРИТИЧНО**
- `bookreader-images-v1.0.0` (30 дней) ⚠️ **КРИТИЧНО**

**КОД НЕ НАЙДЕН:**
```typescript
// Этого НЕТ в cacheManager.ts:
if ('caches' in window) {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}
```

---

### 5. Attack Scenarios

#### Scenario 1: Book Data Leakage

**Steps:**
1. User A (alice@example.com) logs in
2. User A opens Book UUID `abc-123-def`
3. SW caches `/api/v1/books/abc-123-def` in `DYNAMIC_CACHE_NAME`
4. User A logs out
5. `clearAllCaches()` clears TanStack Query + IndexedDB ✅
6. SW cache `DYNAMIC_CACHE_NAME` **НЕ очищается** ❌
7. User B (bob@example.com) logs in
8. User B goes offline
9. User B navigates to `/books/abc-123-def` (somehow)
10. SW returns cached response from User A's session ⚠️

**Impact:** Medium (requires offline + knowing UUID)

#### Scenario 2: Image Leakage

**Steps:**
1. User A generates image for description `desc-456`
2. Image cached: `/api/v1/images/book/abc-123-def` → 30 days
3. User A logs out
4. User B logs in
5. User B requests same image URL
6. SW returns cached image from User A ⚠️

**Impact:** HIGH (images cached 30 days, easier to trigger)

#### Scenario 3: Stale Data After Subscription Change

**Steps:**
1. FREE user loads library (empty, no books)
2. SW caches static assets
3. User upgrades to PREMIUM via external payment
4. Backend updates subscription
5. User refreshes app
6. SW serves cached `/index.html` + old JS bundle
7. App shows stale subscription status until hard refresh

**Impact:** Low (UX issue, not security)

---

### 6. Backend Cache-Control Headers

**Проверка:** `grep -rn "Cache-Control" backend/app/routers/`

**Результат:** ❌ **НЕ НАЙДЕНО**

Backend **НЕ устанавливает** `Cache-Control` headers для API responses.

**Проблема:** Даже если backend установит `Cache-Control: no-store`, SW **игнорирует** эти заголовки и кэширует ответы согласно своей логике (строка 210-223).

---

## 🚨 Критические уязвимости

### CVE-LIKE-2025-001: Service Worker Cache Not Cleared on Logout

**Severity:** 🔴 HIGH
**CVSS Score:** 7.5 (Confidentiality Impact: High)

**Description:**
Service Worker cache (`DYNAMIC_CACHE_NAME`, `bookreader-images-v1.0.0`) not cleared on user logout, allowing subsequent users on the same device to access cached API responses and images from previous sessions.

**Affected Components:**
- `/frontend/public/sw.js` (lines 204-294)
- `/frontend/src/utils/cacheManager.ts` (missing SW cache clearing)

**Attack Vector:**
1. Shared device (library computer, family tablet)
2. User A logs in, loads data
3. User A logs out
4. User B logs in on same device
5. User B can access User A's cached data in offline mode

**Mitigation:**
Add Service Worker cache clearing to `clearAllCaches()`:

```typescript
// In cacheManager.ts
export async function clearAllCaches(): Promise<ClearCacheResult> {
  // ... existing code ...

  // 5. Clear Service Worker caches
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const deletePromises = cacheNames.map(name => caches.delete(name));
      await Promise.all(deletePromises);
      result.serviceWorkerCacheCleared = true;
      console.log('✅ [CacheManager] Service Worker caches cleared');
    }
  } catch (error) {
    result.errors.push(`Service Worker cache: ${error.message}`);
  }
}
```

---

### CVE-LIKE-2025-002: User-Specific Data Cached Without User Isolation

**Severity:** 🟡 MEDIUM
**CVSS Score:** 5.3

**Description:**
API responses containing user-specific data (book details, chapters) are cached in Service Worker using only request URL as key, without user ID isolation.

**Affected Endpoints:**
- `/api/v1/books/{uuid}` (book details)
- `/api/v1/books/{uuid}/chapters/{number}` (chapter content)
- `/api/v1/images/book/{uuid}` (generated images)

**Mitigation:**
Option 1: Exclude user-specific data from SW cache (recommended):
```javascript
const API_NO_CACHE_PATTERNS = [
  /\/api\/v1\/books$/,
  /\/api\/v1\/books\?/,
  /\/api\/v1\/books\/[a-f0-9-]+$/,  // Add this
  /\/api\/v1\/auth\//,
  /\/api\/v1\/admin\//,
];
```

Option 2: Add user ID to cache key:
```javascript
async function handleAPIRequest(request) {
  const userId = getUserIdFromToken(); // Extract from JWT
  const cacheKey = new Request(`${request.url}?user=${userId}`);
  // Use cacheKey instead of request
}
```

---

## 📊 Comparison with Best Practices

| Aspect | Current Implementation | Best Practice | Status |
|--------|----------------------|---------------|--------|
| Books list caching | ❌ Excluded from SW | ✅ Managed by TanStack Query | ✅ GOOD |
| Specific book caching | ✅ Cached 1 hour in SW | ❌ Should be excluded or user-isolated | ⚠️ ISSUE |
| Image caching | ✅ Cached 30 days | ⚠️ Should include user ID in key | ⚠️ ISSUE |
| SW cache clearing on logout | ❌ Not implemented | ✅ Must clear on logout | 🔴 CRITICAL |
| Cache-Control headers | ❌ Not set by backend | ✅ Should set `no-store` for user data | ⚠️ MISSING |
| Cache versioning | ✅ Version in cache name | ✅ Good for updates | ✅ GOOD |
| Cache size limits | ✅ Implemented | ✅ Prevents unbounded growth | ✅ GOOD |
| Offline fallback | ✅ Implemented | ✅ Good UX | ✅ GOOD |

---

## 🎯 Рекомендации (приоритизированные)

### 1. 🔴 КРИТИЧНО: Очистка SW cache при logout

**Приоритет:** P0 (немедленно)
**Сложность:** Low (30 минут)

**Файл:** `frontend/src/utils/cacheManager.ts`

**Изменения:**
```typescript
interface ClearCacheResult {
  // ... existing fields ...
  serviceWorkerCacheCleared: boolean; // ADD
}

export async function clearAllCaches(): Promise<ClearCacheResult> {
  const result: ClearCacheResult = {
    // ... existing fields ...
    serviceWorkerCacheCleared: false, // ADD
  };

  // ... existing code ...

  // 5. Clear Service Worker caches
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('[CacheManager] Found SW caches:', cacheNames);

      const deletePromises = cacheNames.map(name => {
        console.log('[CacheManager] Deleting SW cache:', name);
        return caches.delete(name);
      });

      await Promise.all(deletePromises);
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

**Testing:**
```javascript
// In browser console after logout:
caches.keys().then(console.log); // Should return []
```

---

### 2. 🟡 ВАЖНО: Исключить user-specific data из SW кэша

**Приоритет:** P1 (эта неделя)
**Сложность:** Low (15 минут)

**Файл:** `frontend/public/sw.js`

**Изменения:**
```javascript
// BEFORE:
const API_CACHE_PATTERNS = [
  /\/api\/v1\/books\/[a-f0-9-]+$/,  // ❌ Remove
  /\/api\/v1\/books\/[a-f0-9-]+\/chapters\/\d+$/,  // ❌ Remove
  /\/api\/v1\/images\/book\/[a-f0-9-]+$/,  // ❌ Remove
];

// AFTER:
const API_CACHE_PATTERNS = [
  // Empty - no API caching in SW
  // TanStack Query + IndexedDB handle this
];

const API_NO_CACHE_PATTERNS = [
  /\/api\/v1\/books$/,
  /\/api\/v1\/books\?/,
  /\/api\/v1\/books\/[a-f0-9-]+$/,  // ✅ Add
  /\/api\/v1\/books\/[a-f0-9-]+\/chapters\//,  // ✅ Add
  /\/api\/v1\/images\//,  // ✅ Add (broader pattern)
  /\/api\/v1\/auth\//,
  /\/api\/v1\/admin\//,
];
```

**Обоснование:**
- TanStack Query уже управляет API кэшом
- IndexedDB (chapterCache, imageCache) обеспечивает offline support
- SW должен кэшировать только static assets, НЕ user data

**Impact:**
- ✅ Устраняет user data leakage
- ✅ Упрощает cache management
- ⚠️ Offline mode будет использовать IndexedDB (уже реализовано)

---

### 3. 🟢 УЛУЧШЕНИЕ: Backend Cache-Control headers

**Приоритет:** P2 (следующий спринт)
**Сложность:** Medium (2 часа)

**Файл:** `backend/app/core/middleware.py` (создать)

**Код:**
```python
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

class CacheControlMiddleware(BaseHTTPMiddleware):
    """Add Cache-Control headers to API responses"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # User-specific data - never cache
        if request.url.path.startswith('/api/v1/books/'):
            if request.url.path != '/api/v1/books':  # Specific book
                response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'

        # Images - cache but require revalidation
        elif '/images/' in request.url.path:
            response.headers['Cache-Control'] = 'no-store'

        # Lists - short cache OK (managed by TanStack Query)
        elif request.url.path == '/api/v1/books':
            response.headers['Cache-Control'] = 'private, max-age=10'

        return response
```

**Добавить в `main.py`:**
```python
from app.core.middleware import CacheControlMiddleware

app.add_middleware(CacheControlMiddleware)
```

**Примечание:** Это defense-in-depth, но SW может игнорировать эти заголовки.

---

### 4. 🟢 УЛУЧШЕНИЕ: SW cache invalidation при новой версии

**Приоритет:** P3 (nice to have)
**Сложность:** Low (30 минут)

**Файл:** `frontend/public/sw.js`

**Обновить версии:**
```javascript
// Increment on each deployment
const CACHE_VERSION = '1.2.0'; // Was 1.1.0
const STATIC_CACHE_NAME = `bookreader-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `bookreader-dynamic-v${CACHE_VERSION}`;
```

**Activate event уже очищает старые версии (строки 78-102):**
```javascript
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const deletePromises = cacheNames.map(cacheName => {
        if (cacheName !== STATIC_CACHE_NAME &&
            cacheName !== DYNAMIC_CACHE_NAME) {
          console.log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName); // ✅ Already implemented
        }
      });

      await Promise.all(deletePromises);
      self.clients.claim();
    })()
  );
});
```

**✅ Уже реализовано правильно!**

---

## 🔧 Implementation Plan

### Phase 1: Emergency Fix (Today)

**Goal:** Prevent user data leakage on logout

**Tasks:**
1. ✅ Add SW cache clearing to `cacheManager.ts`
2. ✅ Update `ClearCacheResult` interface
3. ✅ Test logout flow
4. ✅ Deploy to production

**Time:** 1 hour
**Risk:** Low (additive change)

---

### Phase 2: API Cache Exclusion (This Week)

**Goal:** Prevent SW from caching user-specific data

**Tasks:**
1. ✅ Update `API_NO_CACHE_PATTERNS` in `sw.js`
2. ✅ Remove `API_CACHE_PATTERNS` entries
3. ✅ Bump SW version to 1.2.0
4. ✅ Test offline mode (should use IndexedDB, not SW cache)
5. ✅ Deploy

**Time:** 2 hours
**Risk:** Low (TanStack Query + IndexedDB already handle this)

---

### Phase 3: Backend Headers (Next Sprint)

**Goal:** Defense-in-depth with proper Cache-Control headers

**Tasks:**
1. ✅ Create `CacheControlMiddleware`
2. ✅ Add tests for headers
3. ✅ Document caching strategy
4. ✅ Deploy

**Time:** 3 hours
**Risk:** Low (doesn't affect SW, but good practice)

---

## 📈 Metrics to Monitor

After implementing fixes, monitor:

1. **SW Cache Size:**
   ```javascript
   // In browser console
   caches.keys().then(async names => {
     for (const name of names) {
       const cache = await caches.open(name);
       const keys = await cache.keys();
       console.log(`${name}: ${keys.length} entries`);
     }
   });
   ```

2. **Cache Hit Rate:**
   - Check SW console logs: `[SW] Network failed, trying cache`
   - Should ONLY happen for static assets, NOT API data

3. **Logout Cache Clearing:**
   ```javascript
   // After logout
   caches.keys().then(keys => {
     console.log('SW caches after logout:', keys); // Should be []
   });
   ```

4. **User Complaints:**
   - "Seeing other user's books" → HIGH PRIORITY
   - "Stale data after refresh" → Monitor

---

## 🎓 Lessons Learned

### What Went Well:
1. ✅ Books list excluded from SW cache (v1.1.0 fix)
2. ✅ TanStack Query properly manages server state
3. ✅ IndexedDB provides offline support
4. ✅ SW cache versioning implemented

### What Went Wrong:
1. ❌ SW cache not included in `clearAllCaches()`
2. ❌ User-specific data cached without user isolation
3. ❌ No security review of SW caching strategy
4. ❌ Backend doesn't set Cache-Control headers

### Prevention for Future:
1. 📝 Add "Cache clearing audit" to logout PR checklist
2. 📝 Document all caching layers (SW, TanStack Query, IndexedDB)
3. 📝 Security review for any new caching mechanisms
4. 📝 Automated test: "Check all caches cleared after logout"

---

## 📚 References

**Documentation:**
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Cache Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [TanStack Query Caching](https://tanstack.com/query/latest/docs/framework/react/guides/caching)

**Similar Issues:**
- [Workbox: Clear caches on logout](https://github.com/GoogleChrome/workbox/issues/1254)
- [PWA: User isolation in Service Workers](https://web.dev/service-worker-lifecycle/)

**Internal Docs:**
- `/docs/guides/caching/`
- `/docs/reference/api/service-worker.md`

---

## ✅ Action Items

**Immediate (Today):**
- [ ] Implement SW cache clearing in `cacheManager.ts`
- [ ] Test logout flow with SW cache inspection
- [ ] Update SW version to 1.2.0
- [ ] Deploy emergency fix

**Short-term (This Week):**
- [ ] Exclude user-specific APIs from SW cache
- [ ] Update documentation
- [ ] Add automated tests for cache clearing
- [ ] Code review with security focus

**Long-term (Next Sprint):**
- [ ] Implement backend Cache-Control headers
- [ ] Add monitoring for cache sizes
- [ ] Security audit of all caching layers
- [ ] Document caching strategy in architecture docs

---

**Подготовил:** Claude Code (Frontend Developer Agent)
**Проверено:** Pending
**Статус:** URGENT - Requires immediate action

---

## Appendix A: Service Worker Code Snippets

### Current SW Cache Handling (BEFORE fix):

```javascript
// /frontend/public/sw.js (lines 204-260)

async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      const responseClone = networkResponse.clone();

      // ⚠️ PROBLEM: Caches user-specific data without user ID
      cache.put(request, cachedResponse);

      cleanupCache(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE.dynamic);
    }

    return networkResponse;
  } catch (error) {
    // ⚠️ PROBLEM: Returns cached data without checking user
    const cachedResponse = await cache.match(request);
    return cachedResponse || errorResponse;
  }
}
```

### Proposed Fix:

```javascript
// Option 1: Remove API caching entirely (RECOMMENDED)
async function handleAPIRequest(request) {
  // Pass-through to network, no caching
  return fetch(request);
}

// Option 2: Add user isolation (more complex)
async function handleAPIRequest(request) {
  const userId = await getUserIdFromAuth(); // From token
  if (!userId) {
    return fetch(request); // Not authenticated, don't cache
  }

  const cacheKey = `${request.url}?user=${userId}`;
  // ... rest of caching logic with user-specific key
}
```

---

## Appendix B: Test Cases

### Test 1: SW Cache Cleared on Logout

```typescript
describe('Service Worker Cache Clearing', () => {
  it('should clear all SW caches on logout', async () => {
    // Setup: Login and cache some data
    await login('user1@test.com', 'password');
    await fetch('/api/v1/books/test-uuid');

    // Verify cache exists
    const cachesBefore = await caches.keys();
    expect(cachesBefore.length).toBeGreaterThan(0);

    // Logout
    await logout();

    // Verify cache cleared
    const cachesAfter = await caches.keys();
    expect(cachesAfter.length).toBe(0);
  });
});
```

### Test 2: User Data Isolation

```typescript
describe('User Data Isolation', () => {
  it('should not serve cached data to different user', async () => {
    // User A logs in and loads book
    await login('userA@test.com', 'password');
    const bookA = await fetch('/api/v1/books/test-uuid');
    expect(bookA.title).toBe('Book A');

    // User A logs out
    await logout();

    // User B logs in
    await login('userB@test.com', 'password');

    // Go offline
    await setNetworkOffline();

    // Try to access same book UUID
    const response = await fetch('/api/v1/books/test-uuid');

    // Should NOT get cached data from User A
    expect(response.status).toBe(503); // Offline, no cache
    // OR expect(response.data.user_id).toBe('userB'); // If cached with user ID
  });
});
```

---

**END OF REPORT**
