# Диаграмма изоляции кэшей - Current vs Fixed

## 🔴 CURRENT STATE (УЯЗВИМО)

```
┌─────────────────────────────────────────────────────────────┐
│                    IndexedDB (Browser)                      │
│                                                             │
│  BookReaderChapterCache:                                    │
│  ├─ chapters/                                               │
│  │  ├─ "book123_1" → {descriptions, images}  ← User A data │
│  │  ├─ "book123_2" → {descriptions, images}  ← User A data │
│  │  └─ "book456_1" → {descriptions, images}  ← User A data │
│  │                                                          │
│  BookReaderImageCache:                                      │
│  ├─ images/                                                 │
│  │  ├─ "book123_desc1" → {blob, url}        ← User A data  │
│  │  └─ "book123_desc2" → {blob, url}        ← User A data  │
│  │                                                          │
│  BookReaderAI:                                              │
│  └─ epub_locations/                                         │
│     ├─ "book123" → {locations}              ← User A data  │
│     └─ "book456" → {locations}              ← User A data  │
└─────────────────────────────────────────────────────────────┘

         ⬇️  User A Logout + clearAllCaches()

┌─────────────────────────────────────────────────────────────┐
│  ⚠️  ПРОБЛЕМА 1: epub_locations НЕ очищается!               │
│  ⚠️  ПРОБЛЕМА 2: Race condition - может остаться кэш        │
│  ⚠️  ПРОБЛЕМА 3: localStorage pending_sessions остается     │
└─────────────────────────────────────────────────────────────┘

         ⬇️  User B Login

┌─────────────────────────────────────────────────────────────┐
│  User B видит те же ключи:                                  │
│  ├─ "book123_1" ← ❌ Data from User A!                      │
│  ├─ "book123" locations ← ❌ Data from User A!              │
│  └─ pending_sessions ← ❌ Sessions from User A!             │
│                                                             │
│  🔴 УТЕЧКА ДАННЫХ МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ!                     │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ FIXED STATE (БЕЗОПАСНО)

```
┌─────────────────────────────────────────────────────────────┐
│                    IndexedDB (Browser)                      │
│                                                             │
│  BookReaderChapterCache v2:                                 │
│  ├─ chapters/                                               │
│  │  ├─ "userA_book123_1" → {userId, descriptions, images}  │
│  │  ├─ "userA_book123_2" → {userId, descriptions, images}  │
│  │  └─ "userB_book456_1" → {userId, descriptions, images}  │
│  │     ⬆️  Изоляция по userId!                             │
│  │                                                          │
│  BookReaderImageCache v2:                                   │
│  ├─ images/                                                 │
│  │  ├─ "userA_book123_desc1" → {userId, blob, url}         │
│  │  └─ "userB_book456_desc1" → {userId, blob, url}         │
│  │     ⬆️  Изоляция по userId!                             │
│  │                                                          │
│  BookReaderAI v2:                                           │
│  └─ epub_locations/                                         │
│     ├─ ["userA", "book123"] → {userId, locations}          │
│     └─ ["userB", "book456"] → {userId, locations}          │
│        ⬆️  Composite key [userId, bookId]                  │
└─────────────────────────────────────────────────────────────┘

         ⬇️  User A Logout + clearAllCaches(userA.id)

┌─────────────────────────────────────────────────────────────┐
│  ✅ Очищаются ТОЛЬКО записи с userId="userA":               │
│  ├─ DELETE WHERE userId="userA" AND bookId=*                │
│  ├─ DELETE epub_locations WHERE userId="userA"              │
│  └─ REMOVE localStorage bookreader_pending_sessions_userA   │
│                                                             │
│  Записи User B остаются нетронутыми! ✅                     │
└─────────────────────────────────────────────────────────────┘

         ⬇️  User B Login

┌─────────────────────────────────────────────────────────────┐
│  User B видит ТОЛЬКО свои данные:                           │
│  ├─ "userB_book456_1" ✅ Own data                           │
│  ├─ ["userB", "book456"] locations ✅ Own data              │
│  └─ pending_sessions_userB ✅ Own sessions                  │
│                                                             │
│  ✅ ПОЛНАЯ ИЗОЛЯЦИЯ ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ!                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Сравнение ключей

### chapterCache

| Состояние | Ключ | Индекс | Изоляция |
|-----------|------|--------|----------|
| ❌ Current | `${bookId}_${chapterNumber}` | `bookId` | НЕТ |
| ✅ Fixed | `${userId}_${bookId}_${chapterNumber}` | `['userId', 'bookId']` | ДА |

### imageCache

| Состояние | Ключ | Индекс | Изоляция |
|-----------|------|--------|----------|
| ❌ Current | `${bookId}_${descriptionId}` | `bookId` | НЕТ |
| ✅ Fixed | `${userId}_${bookId}_${descriptionId}` | `['userId', 'bookId']` | ДА |

### epub_locations

| Состояние | keyPath | Изоляция | Очистка при logout |
|-----------|---------|----------|-------------------|
| ❌ Current | `bookId` | НЕТ | ❌ НЕ очищается |
| ✅ Fixed | `['userId', 'bookId']` | ДА | ✅ Очищается |

---

## localStorage изоляция

### ❌ Current (уязвимо)

```
localStorage:
├─ reader-storage → {
│    readingProgress: {
│      "book123": {...},  ← Один ключ для всех пользователей!
│      "book456": {...}
│    }
│  }
└─ bookreader_pending_sessions → [
     {type: "update", bookId: "book123"},  ← Не очищается!
   ]
```

### ✅ Fixed (безопасно)

```
localStorage:
├─ reader-storage-userA → {
│    userId: "userA",
│    readingProgress: {
│      "book123": {...}  ← Только книги User A
│    }
│  }
├─ reader-storage-userB → {
│    userId: "userB",
│    readingProgress: {
│      "book456": {...}  ← Только книги User B
│    }
│  }
└─ bookreader_pending_sessions_userA → [...]  ← С userId в ключе
```

---

## Алгоритм clearAllCaches()

### ❌ Current

```
function clearAllCaches() {
  queryClient.clear()
  await chapterCache.clearAll()      // Удаляет ВСЁ (всех пользователей)
  await imageCache.clearAll()        // Удаляет ВСЁ (всех пользователей)
  useReaderStore.reset()
  // ❌ epub_locations НЕ очищается
  // ❌ pending_sessions НЕ очищается
}
```

**Проблемы:**
- Удаляет данные ВСЕХ пользователей на устройстве
- Не очищает epub_locations
- Не очищает pending_sessions

### ✅ Fixed

```
function clearAllCaches(userId: string) {
  queryClient.clear()

  // Очистка только данных текущего пользователя
  await chapterCache.clearUserData(userId)
  await imageCache.clearUserData(userId)
  await clearEpubLocations(userId)

  // localStorage с userId в ключе
  localStorage.removeItem(`reader-storage-${userId}`)
  localStorage.removeItem(`bookreader_pending_sessions_${userId}`)

  useReaderStore.reset(userId)
}
```

**Преимущества:**
- Удаляет ТОЛЬКО данные текущего пользователя
- Очищает ВСЕ кэши (включая epub_locations)
- Данные других пользователей сохраняются

---

## Миграция данных

### Автоматическая миграция при bumping DB_VERSION

```typescript
// chapterCache.ts
const DB_VERSION = 2; // ← Increment!

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 2) {
    // 1. Delete old store (without userId)
    if (db.objectStoreNames.contains(STORE_NAME)) {
      db.deleteObjectStore(STORE_NAME);
    }

    // 2. Create new store with userId
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    store.createIndex('userId', 'userId', { unique: false });
    store.createIndex('userBook', ['userId', 'bookId'], { unique: false });
    store.createIndex('userBookChapter', ['userId', 'bookId', 'chapterNumber'], { unique: true });
  }
};
```

**Результат:**
- Старые данные (без userId) автоматически удаляются
- Новая структура с userId создается
- Users начинают с пустым кэшем (безопасно)

---

## Сценарий использования

### ❌ До исправления

```
User A:
  Login → Read book "123" → Cache: "123_1", "123_2"
  Logout → clearAll() (может не завершиться)

User B:
  Login → Open book "123"
  ❌ Видит кэшированные главы User A!
```

### ✅ После исправления

```
User A:
  Login (userId="alice") → Read book "123"
  Cache: "alice_123_1", "alice_123_2"
  Logout → clearAllCaches("alice")
  ✅ Удаляются ТОЛЬКО "alice_*" записи

User B:
  Login (userId="bob") → Open book "123"
  Cache miss (нет "bob_123_1")
  Fetch from API → Cache: "bob_123_1"
  ✅ Полная изоляция данных!
```

---

**Вывод:** После исправления каждый пользователь имеет **полностью изолированный** кэш, что соответствует GDPR и best practices безопасности.
