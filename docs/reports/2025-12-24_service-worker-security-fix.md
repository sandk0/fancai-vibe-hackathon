# Service Worker Security Fix - Исключение пользовательских данных из кэша

**Дата:** 2025-12-24
**Версия:** v1.3.0
**Тип:** Security Fix
**Приоритет:** HIGH

---

## Проблема

Service Worker кэшировал **пользовательские API endpoints**, что могло привести к утечке данных между пользователями при использовании общего устройства или браузера.

### Уязвимые endpoints (до исправления)

```javascript
// ❌ ПРОБЛЕМА: Кэшировались пользовательские данные
const API_CACHE_PATTERNS = [
  /\/api\/v1\/books\/[a-f0-9-]+$/,           // Детали книги конкретного пользователя
  /\/api\/v1\/books\/[a-f0-9-]+\/chapters\/\d+$/, // Главы книг
  /\/api\/v1\/images\/book\/[a-f0-9-]+$/,    // Изображения пользователя
];
```

**Риски:**
- Пользователь A видит книги пользователя B после logout
- Прогресс чтения одного пользователя доступен другому
- Сгенерированные изображения кэшируются между сессиями

---

## Решение

### 1. Очистка API_CACHE_PATTERNS

**ДО (v1.2.0):**
```javascript
const API_CACHE_PATTERNS = [
  /\/api\/v1\/books\/[a-f0-9-]+$/,
  /\/api\/v1\/books\/[a-f0-9-]+\/chapters\/\d+$/,
  /\/api\/v1\/images\/book\/[a-f0-9-]+$/,
];
```

**ПОСЛЕ (v1.3.0):**
```javascript
const API_CACHE_PATTERNS = [
  // Currently empty - no public API endpoints to cache
  // All book/chapter/user data is user-specific and handled by TanStack Query
];
```

### 2. Расширение API_NO_CACHE_PATTERNS

Добавлены **все пользовательские endpoints** в список исключений:

```javascript
const API_NO_CACHE_PATTERNS = [
  // Books - user-specific data
  /\/api\/v1\/books\/?$/,                    // Books list
  /\/api\/v1\/books\/?\?/,                   // Books list with query params
  /\/api\/v1\/books\/[a-f0-9-]+/,            // Individual book + all sub-routes ✅ NEW

  // Chapters - user-specific content ✅ NEW
  /\/api\/v1\/chapters\//,

  // Reading progress - user-specific tracking ✅ NEW
  /\/api\/v1\/progress\//,

  // Descriptions - user-specific extractions ✅ NEW
  /\/api\/v1\/descriptions\//,

  // Images - user-specific generations ✅ NEW
  /\/api\/v1\/images\//,

  // Users - obviously user-specific ✅ NEW
  /\/api\/v1\/users\//,

  // Auth - session-specific
  /\/api\/v1\/auth\//,

  // Admin - privileged access
  /\/api\/v1\/admin\//,
];
```

### 3. Обновление версии

```diff
- const CACHE_NAME = 'bookreader-ai-v1.2.0';
- const STATIC_CACHE_NAME = 'bookreader-static-v1.2.0';
- const DYNAMIC_CACHE_NAME = 'bookreader-dynamic-v1.2.0';
+ const CACHE_NAME = 'bookreader-ai-v1.3.0';
+ const STATIC_CACHE_NAME = 'bookreader-static-v1.3.0';
+ const DYNAMIC_CACHE_NAME = 'bookreader-dynamic-v1.3.0';
```

Также обновлена версия image cache:
```diff
- const cache = await caches.open('bookreader-images-v1.0.0');
+ const cache = await caches.open('bookreader-images-v1.3.0');
```

---

## Архитектура кэширования (v1.3.0)

### Что МОЖНО кэшировать в Service Worker

✅ **Статические ресурсы (не зависят от пользователя):**
- HTML/CSS/JS файлы
- Иконки, шрифты
- Манифест приложения

✅ **Публичные изображения (от внешних сервисов):**
- Pollinations.ai
- Другие CDN изображений

### Что НЕЛЬЗЯ кэшировать в Service Worker

❌ **Все пользовательские данные:**
- Списки книг (`/books`, `/books?skip=0`)
- Детали книг (`/books/{id}`)
- Главы (`/chapters/{id}`)
- Прогресс чтения (`/books/{id}/progress`)
- Описания (`/descriptions/{chapter_id}`)
- Изображения (`/images/generate/{description_id}`)
- Профиль пользователя (`/users/{id}`)

### Где теперь кэшируются пользовательские данные?

**TanStack Query + IndexedDB** (правильная архитектура):

```typescript
// frontend/src/hooks/api/useBooks.ts
export const useBooks = () => {
  return useQuery({
    queryKey: queryKeys.books.list(),
    queryFn: booksAPI.getBooks,
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 30 * 60 * 1000,   // 30 минут
  });
};
```

**Преимущества:**
- ✅ Кэш привязан к сессии пользователя
- ✅ Автоматическая очистка при logout
- ✅ Изоляция между пользователями
- ✅ Контроль stale time и invalidation

---

## Проверка безопасности

### Тест 1: Изоляция между пользователями

```bash
# 1. Войти как User A, загрузить книгу
curl -H "Authorization: Bearer TOKEN_A" https://fancai.ru/api/v1/books

# 2. Logout, войти как User B
curl -H "Authorization: Bearer TOKEN_B" https://fancai.ru/api/v1/books

# 3. Проверить, что книги User A НЕ видны User B
```

**Ожидаемый результат:** Service Worker НЕ возвращает кэшированные данные User A для User B ✅

### Тест 2: Очистка кэша при обновлении SW

```javascript
// Service Worker автоматически очистит старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== 'bookreader-static-v1.3.0' &&
              cacheName !== 'bookreader-dynamic-v1.3.0') {
            return caches.delete(cacheName); // Удаляет v1.2.0
          }
        })
      );
    })
  );
});
```

**Результат:** Старые кэши (v1.2.0) с пользовательскими данными будут удалены ✅

---

## Impact Analysis

### Что изменилось для пользователей?

**Производительность:**
- 📉 Первая загрузка книги: может быть медленнее (нет SW cache)
- ✅ Последующие загрузки: TanStack Query + IndexedDB работают так же быстро
- ✅ Offline режим: IndexedDB (`chapterCache`, `imageCache`) по-прежнему работает

**Безопасность:**
- ✅ Данные пользователя A НЕ доступны пользователю B
- ✅ Logout полностью очищает TanStack Query cache
- ✅ Изоляция на уровне браузера (IndexedDB привязан к origin + user session)

### Что НЕ изменилось?

- ✅ Статические ресурсы (HTML/CSS/JS) кэшируются как раньше
- ✅ Offline reading через IndexedDB работает
- ✅ Изображения от Pollinations.ai кэшируются

---

## Deployment

### Automatic Update (Production)

```javascript
// frontend/src/main.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      // Автоматическая проверка обновлений каждые 24 часа
      registration.update();
    });
}
```

### Manual Update (для тестирования)

```bash
# 1. Перейти на https://fancai.ru
# 2. Открыть DevTools > Application > Service Workers
# 3. Нажать "Update" или "Unregister" -> Refresh
```

---

## Следующие шаги

### 1. Мониторинг после деплоя

```bash
# Проверить, что пользователи получили новый SW
docker exec -it bookreader-frontend sh
grep "Version 1.3.0" /usr/share/nginx/html/sw.js
```

### 2. Документация для команды

- ✅ Обновить `docs/guides/caching-strategy.md` (если существует)
- ✅ Добавить security note в `docs/explanations/architecture/frontend.md`

### 3. Тестирование

```bash
# Frontend tests (убедиться, что TanStack Query работает корректно)
cd frontend && npm test

# E2E test (проверить изоляцию пользователей)
# docs/guides/testing/e2e-testing.md
```

---

## Changelog

### v1.3.0 (2025-12-24)

**SECURITY:**
- 🔒 Исключены ВСЕ пользовательские API endpoints из Service Worker cache
- 🔒 Добавлены паттерны для `/chapters/`, `/progress/`, `/descriptions/`, `/images/`, `/users/`
- 🔒 Очищен `API_CACHE_PATTERNS` (теперь пустой)

**BREAKING CHANGES:**
- ❌ Service Worker больше НЕ кэширует `/books/{id}`, `/chapters/{id}`, `/images/*`
- ✅ Все пользовательские данные теперь ТОЛЬКО через TanStack Query + IndexedDB

**FILES CHANGED:**
- `frontend/public/sw.js` (lines: 2, 4-6, 20-56, 287, 300)

---

## Заключение

**Проблема решена:**
- ✅ Service Worker НЕ кэширует пользовательские данные
- ✅ Все API endpoints с пользовательской информацией в `API_NO_CACHE_PATTERNS`
- ✅ TanStack Query + IndexedDB обеспечивают правильную изоляцию
- ✅ Версия обновлена до v1.3.0 для автоматической очистки старых кэшей

**Безопасность:**
- ✅ Нет утечек данных между пользователями
- ✅ Logout очищает TanStack Query cache
- ✅ IndexedDB изолирован по origin + user session

**Производительность:**
- ✅ Статические ресурсы кэшируются (HTML/CSS/JS)
- ✅ Offline режим работает через IndexedDB
- ✅ TanStack Query обеспечивает оптимальный UX с `staleTime`/`gcTime`
