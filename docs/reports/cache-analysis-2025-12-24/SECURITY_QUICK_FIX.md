# 🚨 КРИТИЧНО: Утечка данных между пользователями - Quick Fix

## Проблема

**3 IndexedDB кэша НЕ изолированы по пользователям** → User B видит данные User A на общем устройстве!

## Уязвимые файлы

### 1. `frontend/src/services/chapterCache.ts`
```typescript
// ❌ CURRENT (уязвимо):
id: `${bookId}_${chapterNumber}` // NO userId!

// ✅ FIX:
id: `${userId}_${bookId}_${chapterNumber}`
```

### 2. `frontend/src/services/imageCache.ts`
```typescript
// ❌ CURRENT:
id: `${bookId}_${descriptionId}` // NO userId!

// ✅ FIX:
id: `${userId}_${bookId}_${descriptionId}`
```

### 3. `frontend/src/hooks/epub/useLocationGeneration.ts`
```typescript
// ❌ CURRENT:
keyPath: 'bookId' // NO userId!

// ✅ FIX:
keyPath: ['userId', 'bookId']
```

### 4. `frontend/src/utils/cacheManager.ts`
```typescript
// ❌ MISSING: epub_locations не очищается при logout!

// ✅ ADD:
await clearAllEpubLocations(userId);
localStorage.removeItem('bookreader_pending_sessions');
```

## Быстрые шаги

1. **Добавить `userId` в CachedChapter interface** (chapterCache.ts:24)
2. **Добавить `userId` в CachedImage interface** (imageCache.ts:23)
3. **Обновить ключи**: `${userId}_${bookId}_${...}`
4. **Обновить индексы**: `['userId', 'bookId']`
5. **Increment DB_VERSION** (для миграции старых данных)
6. **Добавить в clearAllCaches()**: epub_locations + pending_sessions

## Полный отчет

См. `INDEXEDDB_LOCALSTORAGE_SECURITY_AUDIT.md`

---

**КРИТИЧНОСТЬ:** 🔴 ВЫСОКАЯ
**GDPR:** ❌ НЕ СООТВЕТСТВУЕТ
**СРОК:** ASAP перед продакшеном
