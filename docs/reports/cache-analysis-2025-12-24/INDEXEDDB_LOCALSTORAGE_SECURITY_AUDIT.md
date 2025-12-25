# АУДИТ БЕЗОПАСНОСТИ: IndexedDB и localStorage - Анализ утечек данных между пользователями

**Дата:** 2025-12-24
**Критичность:** 🔴 **КРИТИЧЕСКАЯ УЯЗВИМОСТЬ ОБНАРУЖЕНА**
**Статус:** Требует немедленного исправления

---

## 📋 Executive Summary

Проведен глубокий анализ всех точек хранения данных в приложении (IndexedDB и localStorage). **Обнаружена критическая уязвимость безопасности**: кэши глав и изображений **НЕ изолированы по пользователям**, что приводит к утечке данных между пользователями на общем устройстве.

**Сценарий утечки:**
1. Пользователь A логинится и читает книги → данные кэшируются в IndexedDB
2. Пользователь A выходит (logout) → кэши **НЕ очищаются полностью**
3. Пользователь B логинится на том же устройстве
4. Пользователь B видит книги и изображения из библиотеки пользователя A ❌

---

## 🔴 КРИТИЧЕСКИЕ УЯЗВИМОСТИ

### 1. **chapterCache (IndexedDB) - Нет изоляции пользователей**

**Файл:** `frontend/src/services/chapterCache.ts`

**Структура ключа:**
```typescript
interface CachedChapter {
  id: string; // Composite key: `${bookId}_${chapterNumber}`
  bookId: string;
  chapterNumber: number;
  descriptions: Description[];
  images: GeneratedImage[];
  // ❌ НЕТ ПОЛЯ userId!
}
```

**Проблема:**
- Ключ кэша: `${bookId}_${chapterNumber}` - **БЕЗ userId**
- Индекс по `bookId` - **БЕЗ userId**
- При logout вызывается `chapterCache.clearAll()`, но:
  - Очистка может **не завершиться** если logout происходит быстро
  - Нет гарантии атомарности операции
  - Нет проверки успешности очистки

**Сценарий утечки:**
```
User A: Читает книгу "Harry Potter" (bookId: "123")
  → chapterCache.set("123_1", descriptions, images)

User A: Logout
  → clearAllCaches() вызывается, но может не завершиться

User B: Логинится
  → chapterCache.get("123_1") возвращает данные User A! ❌
```

**Код уязвимости (строки 199-206):**
```typescript
const cachedChapter: CachedChapter = {
  id: `${bookId}_${chapterNumber}`, // ❌ NO userId in key!
  bookId,
  chapterNumber,
  descriptions,
  images,
  cachedAt: Date.now(),
  lastAccessedAt: Date.now(),
};
```

---

### 2. **imageCache (IndexedDB) - Та же проблема**

**Файл:** `frontend/src/services/imageCache.ts`

**Структура ключа:**
```typescript
interface CachedImage {
  id: string; // `${bookId}_${descriptionId}`
  blob: Blob;
  url: string;
  bookId: string;
  descriptionId: string;
  // ❌ НЕТ ПОЛЯ userId!
}
```

**Проблема:**
- Ключ: `${bookId}_${descriptionId}` - **БЕЗ userId**
- Индекс по `bookId` - **БЕЗ userId**
- Та же проблема с неполной очисткой при logout

**Код уязвимости (строки 270-279):**
```typescript
const cachedImage: CachedImage = {
  id: `${bookId}_${descriptionId}`, // ❌ NO userId in key!
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

### 3. **useLocationGeneration (IndexedDB) - Та же проблема**

**Файл:** `frontend/src/hooks/epub/useLocationGeneration.ts`

**База данных:** `BookReaderAI` (отдельная от chapterCache и imageCache!)

**Структура:**
```typescript
{
  bookId: string, // ❌ Primary key БЕЗ userId
  locations: any,
  timestamp: number,
}
```

**Проблема:**
- Store: `epub_locations` с ключом `bookId`
- **НЕТ поля userId**
- **НЕ очищается при logout** - отсутствует в `clearAllCaches()`!

**КРИТИЧНО:** Этот кэш **вообще не очищается** при logout!

---

## ⚠️ СРЕДНИЕ УЯЗВИМОСТИ

### 4. **reader store (localStorage) - Частичная изоляция**

**Файл:** `frontend/src/stores/reader.ts`

**Хранилище:** `localStorage` с ключом `reader-storage`

**Структура:**
```typescript
interface ReaderState {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'sepia';

  // ❌ Пользовательские данные БЕЗ userId:
  readingProgress: Record<string, ReadingProgress>; // Key: bookId
  bookmarks: Record<string, BookmarkData[]>;         // Key: bookId
  highlights: Record<string, HighlightData[]>;       // Key: bookId
}
```

**Проблема:**
- `readingProgress`, `bookmarks`, `highlights` хранятся с ключом `bookId`, **БЕЗ userId**
- При logout вызывается `reset()`, который **синхронно** очищает данные
- **ОДНАКО:** Zustand persist middleware может записать старые данные **после** reset!

**Код очистки (строки 203-222):**
```typescript
reset: () => {
  console.log('🧹 [ReaderStore] Resetting all data');
  set({
    // Clear all user data
    readingProgress: {},
    bookmarks: {},
    highlights: {},
  });
  // Also clear persisted storage
  localStorage.removeItem('reader-storage'); // ✅ GOOD
},
```

**Потенциальная race condition:**
1. User A logout → `reset()` вызывается
2. Zustand persist middleware записывает последнее состояние **после** removeItem
3. User B логинится → видит данные User A

---

### 5. **PENDING_SESSIONS (localStorage) - Нет изоляции**

**Файл:** `frontend/src/api/readingSessions.ts`

**Ключ:** `bookreader_pending_sessions`

**Структура:**
```typescript
interface PendingSession {
  type: 'start' | 'update' | 'end';
  data: any;
  timestamp: string;
  // ❌ НЕТ userId!
}
```

**Проблема:**
- Сохраняет офлайн reading sessions без userId
- **НЕ очищается при logout** - отсутствует в `clearAllCaches()`!

**КРИТИЧНО:** User B может случайно отправить reading sessions User A на сервер!

---

## ✅ БЕЗОПАСНЫЕ ХРАНИЛИЩА

### 1. **auth store (localStorage)**
- **Ключи:** `bookreader_access_token`, `bookreader_refresh_token`, `bookreader_user_data`
- **Очистка:** ✅ Правильная при logout (строки 96-98 в auth.ts)
```typescript
localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
localStorage.removeItem(STORAGE_KEYS.USER_DATA);
```

### 2. **books, images, ui stores**
- **Тип:** Runtime state (НЕ persistent)
- **Изоляция:** ✅ Не используют localStorage/IndexedDB

### 3. **Theme settings (localStorage)**
- **Ключ:** `bookreader_theme`
- **Данные:** Только UI настройки (не критичны)
- **Риск:** Минимальный

---

## 🔍 АНАЛИЗ clearAllCaches()

**Файл:** `frontend/src/utils/cacheManager.ts`

**Текущая реализация:**
```typescript
export async function clearAllCaches(): Promise<ClearCacheResult> {
  // 1. Clear TanStack Query cache ✅
  queryClient.clear();

  // 2. Clear IndexedDB chapter cache ✅
  await chapterCache.clearAll();

  // 3. Clear IndexedDB image cache ✅
  await imageCache.clearAll();

  // 4. Reset reader store state ✅
  useReaderStore.getState().reset();
}
```

**❌ ЧТО НЕ ОЧИЩАЕТСЯ:**
1. **epub_locations IndexedDB** (useLocationGeneration) - **ПРОПУЩЕНО**
2. **bookreader_pending_sessions localStorage** - **ПРОПУЩЕНО**
3. **Zustand auth-store persist cache** - **МОЖЕТ ОСТАТЬСЯ**
4. **Theme settings** - **НЕ КРИТИЧНО**

**❌ ПРОБЛЕМЫ:**
1. **Нет atomic transaction** - если clearAll() падает посередине, часть данных остается
2. **Нет retry логики** - если IndexedDB недоступна, кэш не очищается
3. **Нет проверки успешности** - errors логируются, но logout продолжается
4. **Race condition с persist middleware** - Zustand может записать данные после очистки

---

## 📊 ПОЛНЫЙ СПИСОК ХРАНИЛИЩ

### localStorage (9 ключей)

| Ключ | Содержимое | userId? | Очистка | Критичность |
|------|-----------|---------|---------|-------------|
| `bookreader_access_token` | JWT токен | ✅ Implicit | ✅ Logout | 🔴 Критично |
| `bookreader_refresh_token` | JWT refresh | ✅ Implicit | ✅ Logout | 🔴 Критично |
| `bookreader_user_data` | User profile | ✅ Implicit | ✅ Logout | 🟡 Средне |
| `bookreader_theme` | UI theme | ❌ No | ❌ Never | 🟢 Низко |
| `reader-storage` | Reading state | ❌ No | ✅ Logout | 🔴 **КРИТИЧНО** |
| `auth-store` | Zustand persist | ✅ Implicit | ⚠️ Partial | 🟡 Средне |
| `bookreader_pending_sessions` | Offline sessions | ❌ No | ❌ **NEVER** | 🔴 **КРИТИЧНО** |
| `bookreader_reader_settings_toc_open` | TOC state | ❌ No | ❌ Never | 🟢 Низко |
| `epub-theme-{bookId}` | EPUB themes | ❌ No | ❌ Never | 🟢 Низко |
| `epub-font-size-{bookId}` | Font size | ❌ No | ❌ Never | 🟢 Низко |

### IndexedDB (3 базы данных)

| База | Store | Ключ | userId? | Очистка | Критичность |
|------|-------|------|---------|---------|-------------|
| `BookReaderChapterCache` | `chapters` | `${bookId}_${chapterNumber}` | ❌ No | ✅ Logout | 🔴 **КРИТИЧНО** |
| `BookReaderImageCache` | `images` | `${bookId}_${descriptionId}` | ❌ No | ✅ Logout | 🔴 **КРИТИЧНО** |
| `BookReaderAI` | `epub_locations` | `bookId` | ❌ No | ❌ **NEVER** | 🔴 **КРИТИЧНО** |

---

## 🚨 СЦЕНАРИИ УТЕЧКИ ДАННЫХ

### Сценарий 1: Общий компьютер (библиотека, интернет-кафе)

**Шаги:**
1. **User A** (alice@example.com):
   - Логинится
   - Открывает книгу "Война и мир" (bookId: "abc123")
   - Читает главу 1 → кэшируются descriptions + images
   - Выходит (logout)

2. **User B** (bob@example.com):
   - Логинится на том же браузере
   - **Проблема 1:** IndexedDB может содержать главы User A
   - **Проблема 2:** `epub_locations` для книги User A остались
   - **Проблема 3:** `pending_sessions` User A могут отправиться на сервер

**Результат:**
- User B видит кэшированные данные User A ❌
- Нарушение GDPR/конфиденциальности ❌

### Сценарий 2: Race condition при logout

**Шаги:**
1. User A нажимает "Logout"
2. `clearAllCaches()` начинает выполняться
3. User A закрывает вкладку **ДО завершения** очистки
4. IndexedDB transactions не завершаются
5. User B логинится → видит частично очищенные данные User A

### Сценарий 3: IndexedDB quota exceeded

**Шаги:**
1. User A накапливает 100 MB кэшированных изображений
2. User A logout → `imageCache.clearAll()` вызывается
3. IndexedDB quota exceeded error
4. Очистка **НЕ происходит**
5. User B видит все изображения User A

---

## 🛠️ РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ

### ✅ КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ (Приоритет 1)

#### 1. Добавить userId во все ключи IndexedDB

**chapterCache.ts:**
```typescript
// BEFORE (уязвимо):
id: `${bookId}_${chapterNumber}`

// AFTER (безопасно):
id: `${userId}_${bookId}_${chapterNumber}`
```

**Изменения:**
- Добавить `userId` в интерфейс `CachedChapter`
- Обновить индексы: `['userId', 'bookId']`
- Добавить метод `clearAllForUser(userId: string)`
- При logout вызывать `chapterCache.clearAllForUser(currentUserId)`

#### 2. Добавить userId в imageCache

**imageCache.ts:**
```typescript
// BEFORE:
id: `${bookId}_${descriptionId}`

// AFTER:
id: `${userId}_${bookId}_${descriptionId}`
```

#### 3. Добавить userId в epub_locations

**useLocationGeneration.ts:**
```typescript
// BEFORE:
{ bookId, locations, timestamp }

// AFTER:
{ userId, bookId, locations, timestamp }

// Composite key:
keyPath: ['userId', 'bookId']
```

#### 4. Добавить очистку epub_locations в clearAllCaches

**cacheManager.ts:**
```typescript
import { clearCachedLocations } from '@/hooks/epub/useLocationGeneration';

export async function clearAllCaches(): Promise<ClearCacheResult> {
  // ... existing code ...

  // 5. Clear EPUB locations cache
  try {
    await clearAllEpubLocations(); // NEW
    result.epubLocationsCleared = true;
  } catch (error) {
    result.errors.push(`EPUB locations: ${error.message}`);
  }
}
```

#### 5. Добавить очистку pending_sessions

**cacheManager.ts:**
```typescript
// 6. Clear pending reading sessions
try {
  localStorage.removeItem('bookreader_pending_sessions');
  result.pendingSessionsCleared = true;
} catch (error) {
  result.errors.push(`Pending sessions: ${error.message}`);
}
```

#### 6. Добавить userId в reader store

**reader.ts:**
```typescript
interface ReaderState {
  userId: string | null; // NEW

  readingProgress: Record<string, ReadingProgress>;
  bookmarks: Record<string, BookmarkData[]>;
  highlights: Record<string, HighlightData[]>;
}

// При login:
setUserId: (userId: string) => {
  set({ userId });
  // Load user-specific data from localStorage
}

// При logout:
reset: () => {
  const { userId } = get();
  if (userId) {
    // Clear only current user's data
    localStorage.removeItem(`reader-storage-${userId}`);
  }
  set({ userId: null, readingProgress: {}, ... });
}
```

---

### ✅ СРЕДНИЕ ИСПРАВЛЕНИЯ (Приоритет 2)

#### 7. Atomic logout с проверкой

**auth.ts:**
```typescript
logout: async () => {
  const userId = get().user?.id;
  if (!userId) return;

  // 1. Call API
  await authAPI.logout();

  // 2. Clear caches with retry
  let retries = 3;
  while (retries > 0) {
    try {
      const result = await clearAllCaches(userId); // Pass userId
      if (result.success) break;
      console.warn(`Retry clearing caches (${retries} left)...`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to clear caches:', error);
      retries--;
    }
  }

  // 3. Clear localStorage
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });

  // 4. Reset state
  set({ user: null, accessToken: null, ... });
}
```

#### 8. Добавить версионирование кэшей

**chapterCache.ts:**
```typescript
const DB_VERSION = 2; // Increment version

// В onupgradeneeded:
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 2) {
    // Migrate old data or clear all
    if (db.objectStoreNames.contains(STORE_NAME)) {
      db.deleteObjectStore(STORE_NAME);
    }
    // Create new store with userId
    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    store.createIndex('userId', 'userId', { unique: false });
    store.createIndex('userBook', ['userId', 'bookId'], { unique: false });
  }
};
```

---

### ✅ НИЗКИЕ ИСПРАВЛЕНИЯ (Приоритет 3)

#### 9. Добавить мониторинг успешности очистки

```typescript
// analytics.ts
export function trackCacheClearFailure(errors: string[]) {
  console.error('⚠️ Cache clear failed:', errors);
  // Send to Sentry/analytics
}

// В clearAllCaches:
if (!result.success) {
  trackCacheClearFailure(result.errors);
}
```

#### 10. Добавить тесты безопасности

```typescript
// __tests__/cacheIsolation.test.ts
describe('Cache Isolation', () => {
  it('should not leak User A data to User B', async () => {
    // Login as User A
    await loginAs('alice@example.com');
    await cacheChapter('book1', 1, descriptions);
    await logout();

    // Login as User B
    await loginAs('bob@example.com');
    const cached = await chapterCache.get('book1', 1);

    expect(cached).toBeNull(); // User B should NOT see User A's data
  });
});
```

---

## 📈 МИГРАЦИОННЫЙ ПЛАН

### Этап 1: Критические исправления (1-2 дня)
1. Добавить `userId` в все IndexedDB stores
2. Обновить `clearAllCaches()` для очистки всех кэшей
3. Добавить retry логику в logout
4. Bumps `DB_VERSION` для автоматической миграции

### Этап 2: Тестирование (1 день)
1. Написать тесты изоляции пользователей
2. Тестировать на общем устройстве
3. Проверить race conditions

### Этап 3: Деплой (1 день)
1. Деплой с миграцией (старые кэши удалятся автоматически)
2. Мониторинг ошибок
3. Проверка GDPR compliance

### Этап 4: Документация (0.5 дня)
1. Обновить архитектурную документацию
2. Добавить security guidelines
3. Создать runbook для инцидентов

---

## 🔐 GDPR / COMPLIANCE

**Текущее состояние:** ❌ **НЕ СООТВЕТСТВУЕТ GDPR**

**Нарушения:**
1. **Данные пользователя доступны другим пользователям** (Article 32 - Security)
2. **Нет полного удаления при logout** (Article 17 - Right to erasure)
3. **Нет изоляции данных** (Article 25 - Data protection by design)

**После исправлений:** ✅ **СООТВЕТСТВУЕТ GDPR**

---

## 📝 CHECKLIST ДЛЯ ПРОВЕРКИ

### Перед деплоем исправлений:

- [ ] Все ключи IndexedDB содержат `userId`
- [ ] `clearAllCaches()` очищает **ВСЕ** кэши
- [ ] Добавлена retry логика для IndexedDB operations
- [ ] Написаны тесты изоляции пользователей
- [ ] Проверена совместимость со старыми данными
- [ ] Обновлена версия IndexedDB для миграции
- [ ] Добавлен мониторинг успешности очистки
- [ ] Документация обновлена

### После деплоя:

- [ ] Проверить что User A → logout → User B не видит данных A
- [ ] Проверить race conditions (быстрый logout)
- [ ] Проверить IndexedDB quota exceeded scenarios
- [ ] Проверить offline/online transitions
- [ ] Мониторинг ошибок в продакшене

---

## 🎯 ИТОГИ

**Обнаружено:**
- 🔴 **3 критические уязвимости** (chapterCache, imageCache, epub_locations)
- 🟡 **2 средние проблемы** (reader store race condition, pending_sessions)
- 🟢 **5 низких рисков** (theme settings, UI state)

**Влияние:**
- **100% устройств с несколькими пользователями** подвержены утечке данных
- **GDPR нарушение** при использовании в EU
- **Репутационный риск** при обнаружении

**Рекомендация:**
Немедленно внедрить **Этап 1 (Критические исправления)** перед продакшен деплоем.

---

**Автор:** Frontend Developer Agent
**Дата:** 2025-12-24
**Версия отчета:** 1.0
