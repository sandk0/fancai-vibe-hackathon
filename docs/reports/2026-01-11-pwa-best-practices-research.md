# Исследование современных практик PWA и анализ проекта fancai

**Дата:** 11 января 2026
**Автор:** Claude Code AI
**Тип:** Исследовательский отчёт
**Версия:** 1.1
**Статус:** P8-1 ✅ P8-2 ✅ P8-3 ✅ P8-4 ✅ | P8-5 ⏳

---

## Содержание

1. [Цели исследования](#1-цели-исследования)
2. [Современные практики PWA background работы](#2-современные-практики-pwa-background-работы)
3. [Анализ Celery-задач и интеграции с PWA](#3-анализ-celery-задач-и-интеграции-с-pwa)
4. [Push Notifications на iOS 18/26](#4-push-notifications-на-ios-1826)
5. [Выявленные пробелы в реализации](#5-выявленные-пробелы-в-реализации)
6. [Рекомендации (P8)](#6-рекомендации-p8)
7. [Заключение](#7-заключение)

---

## 1. Цели исследования

### 1.1 Задачи анализа

1. Изучить современные лучшие практики PWA для работы в фоновом режиме
2. Проанализировать Celery-задачи и их интеграцию с PWA
3. Исследовать реализацию Push Notifications на iOS 18/26
4. Выявить пробелы по сравнению с best practices 2025-2026
5. Составить рекомендации для фазы P8

### 1.2 Методология

- Анализ исходного кода проекта
- Изучение официальной документации (MDN, web.dev, Workbox)
- Исследование ограничений платформ (iOS Safari, Android Chrome)
- Сравнение с современными стандартами PWA

---

## 2. Современные практики PWA background работы

### 2.1 Background Sync API

**Поддержка браузерами (январь 2026):**

| Браузер | Версия | Поддержка |
|---------|--------|-----------|
| Chrome | 49+ | ✅ Полная |
| Edge | 79+ | ✅ Полная |
| Opera | 36+ | ✅ Полная |
| Samsung Internet | 5.0+ | ✅ Полная |
| Firefox | - | ❌ Нет |
| **Safari/iOS** | - | ❌ **НЕТ** |

**Критический вывод:** iOS Safari **не поддерживает** Background Sync API. Это означает, что любые операции синхронизации на iOS должны использовать альтернативные механизмы.

### 2.2 Periodic Background Sync API

**Поддержка (январь 2026):**

| Браузер | Версия | Поддержка |
|---------|--------|-----------|
| Chrome | 80+ | ✅ (только installed PWA) |
| Edge | 80+ | ✅ (только installed PWA) |
| Firefox | - | ❌ Нет |
| **Safari/iOS** | - | ❌ **НЕТ** |

**Особенности:**
- Требует установки PWA на устройство
- Минимальный интервал: 12 часов (зависит от site engagement)
- Chrome использует свой алгоритм для определения частоты
- Не гарантирует точное время выполнения

### 2.3 Ограничения iOS Safari

#### 2.3.1 Кэширование и хранилище

| Ограничение | Значение | Влияние |
|-------------|----------|---------|
| **Максимум кэша** | ~50 MB | Ограниченное offline хранилище |
| **Storage eviction** | 7 дней без использования | Потеря данных без предупреждения |
| **Persistent Storage** | Safari 17+ (частичная) | Требует явного запроса |
| **IndexedDB quota** | ~50 MB (может быть меньше) | Ограничение для книг |

#### 2.3.2 Service Worker ограничения

- **Нет Background Fetch API**
- **Нет Periodic Background Sync**
- **Нет Background Sync API**
- Service Worker может быть остановлен после ~30 секунд без активности
- Web Push работает только в standalone PWA режиме (iOS 16.4+)

### 2.4 Best Practices Workbox 2025-2026

**Рекомендуемые стратегии:**

```typescript
// 1. StaleWhileRevalidate для API запросов
registerRoute(
  /\/api\//,
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 86400 }),
    ],
  })
);

// 2. CacheFirst для статических ресурсов с fallback
registerRoute(
  /\.(js|css|png|jpg|svg)$/,
  new CacheFirst({
    cacheName: 'static-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// 3. NetworkFirst для критических данных
registerRoute(
  /\/api\/v1\/books/,
  new NetworkFirst({
    cacheName: 'books-cache',
    networkTimeoutSeconds: 10,
  })
);
```

**Современные возможности Workbox 7.x:**

1. **workbox-background-sync** - очередь для retry операций
2. **workbox-broadcast-update** - уведомление клиента об обновлениях
3. **workbox-expiration** - автоматическая очистка кэша
4. **workbox-cacheable-response** - фильтрация кэшируемых ответов

### 2.5 Рекомендации для iOS fallback

```typescript
// iOS-compatible sync strategy
class IOSSyncManager {
  private pendingQueue: SyncOperation[] = [];
  private periodicSyncInterval: NodeJS.Timeout | null = null;

  async init() {
    // 1. Periodic sync при visible состоянии
    this.startPeriodicSync(30000); // 30 секунд

    // 2. Sync на online событие
    window.addEventListener('online', () => this.syncAll());

    // 3. Sync перед закрытием (sendBeacon)
    window.addEventListener('pagehide', () => this.emergencySync());

    // 4. Sync на visibilitychange (visible)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncAll();
      }
    });
  }

  private emergencySync() {
    // sendBeacon для критических данных
    if (this.pendingQueue.length > 0) {
      const data = JSON.stringify(this.pendingQueue);
      navigator.sendBeacon('/api/v1/sync/batch', data);
    }
  }
}
```

---

## 3. Анализ Celery-задач и интеграции с PWA

### 3.1 Текущие Celery-задачи

**Файл:** `backend/app/core/tasks.py`

| Задача | Назначение | Retry | Интеграция с PWA |
|--------|------------|-------|------------------|
| `process_book_task` | Парсинг книги + LLM извлечение | 3 retry, backoff | Push notification после завершения |
| `generate_image_task` | Генерация изображения | 3 retry, 30s delay | Push notification после завершения |
| `generate_image_batch_task` | Пакетная генерация | 3 retry | Push notification |

### 3.2 Механизм уведомлений

**Backend Push сервис:** `backend/app/services/push_notification_service.py`

```python
async def send_to_user(self, db, user_id: int, payload: dict, ttl: int = 86400):
    """
    Отправляет push notification пользователю.
    - Поддерживает несколько подписок на пользователя
    - Автоматически деактивирует истёкшие подписки (404/410)
    - Использует pywebpush для Web Push протокола
    """
```

**Триггеры уведомлений:**
1. `process_book_task` → `notify_book_ready` (книга готова)
2. `generate_image_task` → `notify_image_ready` (изображение готово)

### 3.3 Интеграция с PWA

```
┌─────────────────────────────────────────────────────────────────┐
│                    Celery + PWA Integration                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│  │   Frontend  │────▶│   Backend   │────▶│   Celery Task   │   │
│  │   (PWA)     │     │   (API)     │     │   (Worker)      │   │
│  └─────────────┘     └─────────────┘     └────────┬────────┘   │
│        ▲                                          │             │
│        │                                          ▼             │
│        │                              ┌─────────────────────┐   │
│        │                              │  Push Notification  │   │
│        │                              │     Service         │   │
│        │                              └──────────┬──────────┘   │
│        │                                         │              │
│        │         ┌─────────────────┐             │              │
│        └─────────│  Service Worker │◀────────────┘              │
│                  │  (push event)   │                            │
│                  └─────────────────┘                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Выявленные особенности

**Положительные:**
1. ✅ Retry с экспоненциальным backoff и jitter
2. ✅ Push уведомления после завершения задач
3. ✅ Автоматическая деактивация истёкших подписок
4. ✅ Ограничение памяти worker'а (1.5 GB)

**Потенциальные улучшения:**
1. ⚠️ Нет WebSocket для real-time статуса задачи
2. ⚠️ Polling интервалы на frontend могут вызывать проблемы (P7 bug)
3. ⚠️ Нет механизма отмены задачи пользователем
4. ⚠️ Нет progress tracking для долгих задач

---

## 4. Push Notifications на iOS 18/26

### 4.1 Требования iOS для Web Push

| Требование | Описание |
|------------|----------|
| **iOS версия** | 16.4+ |
| **Режим PWA** | Только standalone (установленный на Home Screen) |
| **HTTPS** | Обязательно |
| **Service Worker** | Зарегистрированный SW |
| **User gesture** | Требуется явное действие пользователя для подписки |
| **Permissions API** | `Notification.requestPermission()` |

### 4.2 Текущая реализация в проекте

**Frontend сервис:** `frontend/src/services/pushNotifications.ts`

```typescript
class PushNotificationManager {
  // ✅ Правильная детекция iOS Safari
  isIOSSafari(): boolean {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    return isIOS && isSafari && !('MSStream' in window);
  }

  // ✅ Проверка standalone режима
  isStandalone(): boolean {
    return (
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  }

  // ✅ Корректная проверка возможности использования Push
  canUsePush(): boolean {
    if (!this.isSupported()) return false;
    if (this.isIOSSafari()) return this.isStandalone();
    return true;
  }
}
```

**React Hook:** `frontend/src/hooks/usePushNotifications.ts`

```typescript
export function usePushNotifications() {
  const { data: status } = useQuery({
    queryKey: ['push', 'status'],
    queryFn: async () => pushNotificationManager.getStatus(),
    staleTime: 60000,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => pushNotificationManager.subscribe(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push'] }),
  });

  // ✅ Permission change listener через Permissions API
  useEffect(() => {
    if (!('permissions' in navigator)) return;
    navigator.permissions.query({ name: 'notifications' })
      .then(permission => {
        permission.onchange = () => queryClient.invalidateQueries({ queryKey: ['push'] });
      });
  }, []);
}
```

### 4.3 Ограничения iOS Push (Safari WebKit)

| Ограничение | Описание | Влияние |
|-------------|----------|---------|
| **TTL** | Максимум 24 часа | Уведомления старше 24ч не доставляются |
| **Payload size** | 4 KB | Ограничение на размер данных |
| **Actions** | Только "Open" и "Close" | Нет custom actions |
| **Images** | Нет поддержки | notification.image не работает |
| **Badge** | Ограниченная поддержка | Не всегда обновляется |
| **Silent push** | Нет | Каждый push показывает уведомление |

### 4.4 Рекомендации для iOS Push

```typescript
// Оптимальная конфигурация для iOS
const pushPayload = {
  title: 'Книга готова', // Короткий заголовок
  body: 'Нажмите чтобы открыть', // Короткий текст
  icon: '/icons/icon-192x192.png', // Иконка приложения
  tag: 'book-ready-123', // Группировка уведомлений
  data: {
    url: '/library', // URL для открытия
    bookId: '123',
  },
  // НЕ включать для iOS:
  // - image (не поддерживается)
  // - actions (ограничено)
  // - badge (ненадёжно)
};
```

### 4.5 Оценка текущей реализации

| Критерий | Статус | Комментарий |
|----------|--------|-------------|
| iOS detection | ✅ | Корректная детекция Safari + standalone |
| VAPID setup | ✅ | Правильная конфигурация в backend |
| Permission flow | ✅ | User gesture требуется |
| Subscription storage | ✅ | PostgreSQL с auto-cleanup |
| Error handling | ✅ | 404/410 обработка |
| Payload optimization | ⚠️ | Можно оптимизировать для iOS |
| User guidance | ⚠️ | Нет объяснения требования standalone |

---

## 5. Выявленные пробелы в реализации

### 5.1 Критические пробелы

| ID | Проблема | Влияние | Сложность |
|----|----------|---------|-----------|
| **GAP-1** | Нет Storage Quota management UI | Пользователь не знает о лимитах iOS | Средняя |
| **GAP-2** | Нет guidance для Home Screen install | Push не работает без установки | Низкая |
| **GAP-3** | Periodic Background Sync не реализован для Android | Упущенная возможность | Средняя |

### 5.2 Средние пробелы

| ID | Проблема | Влияние | Сложность |
|----|----------|---------|-----------|
| **GAP-4** | Нет WebSocket для task progress | Polling создаёт нагрузку | Высокая |
| **GAP-5** | Нет Content-Index API | Offline контент не индексируется | Низкая |
| **GAP-6** | Нет Share Target API | Нельзя открыть книги через Share | Средняя |

### 5.3 Низкие пробелы

| ID | Проблема | Влияние | Сложность |
|----|----------|---------|-----------|
| **GAP-7** | Нет File Handling API | Нельзя открыть EPUB из файлового менеджера | Средняя |
| **GAP-8** | Нет Protocol Handler | Нельзя зарегистрировать кастомный протокол | Низкая |

### 5.4 Сравнение с best practices

| Best Practice | Текущий статус | Рекомендация |
|---------------|----------------|--------------|
| **Background Sync** | ✅ iOS fallback реализован | - |
| **Periodic Sync** | ⚠️ Только iOS fallback | Добавить для Android |
| **Push Notifications** | ✅ Работает | Улучшить iOS guidance |
| **Offline Storage** | ✅ IndexedDB + Cache API | Добавить quota UI |
| **Storage Persistence** | ✅ Реализовано (P4) | - |
| **Wake Lock** | ✅ Реализовано (P5) | Интегрировать в Reader |
| **Navigation Preload** | ✅ Реализовано (P5) | - |
| **App Badging** | ✅ Реализовано (P5) | - |
| **Content-Index** | ❌ Не реализовано | Рассмотреть |
| **Share Target** | ❌ Не реализовано | Рассмотреть |

---

## 6. Рекомендации (P8)

### 6.1 Фаза P8: Дополнительные улучшения

#### P8-1: Storage Quota UI

**Приоритет:** СРЕДНИЙ
**Сложность:** Низкая

**Описание:** Показывать пользователю информацию о использовании хранилища.

```typescript
// Компонент StorageQuotaInfo
function StorageQuotaInfo() {
  const { usedMB, totalMB, percentage } = useStorageInfo();

  return (
    <div className="storage-info">
      <ProgressBar value={percentage} />
      <span>{usedMB} MB из {totalMB} MB</span>
      {percentage > 80 && (
        <Alert>Рекомендуем очистить кэш неиспользуемых книг</Alert>
      )}
    </div>
  );
}
```

**Файлы:**
- Создать: `src/components/Settings/StorageQuotaInfo.tsx`
- Изменить: `src/pages/SettingsPage.tsx`

---

#### P8-2: iOS Home Screen Guidance

**Приоритет:** ВЫСОКИЙ
**Сложность:** Низкая

**Описание:** Улучшить UX для iOS пользователей - объяснить необходимость установки для Push.

```typescript
// Улучшение IOSInstallInstructions
function IOSInstallInstructions() {
  const { isIOSSafari, isStandalone, canUsePush } = usePushNotifications();

  if (isIOSSafari && !isStandalone) {
    return (
      <Banner type="info">
        <h3>Установите приложение для полного функционала</h3>
        <ul>
          <li>✅ Push-уведомления о готовности книг</li>
          <li>✅ Быстрый доступ с главного экрана</li>
          <li>✅ Полноэкранный режим</li>
        </ul>
        <Button onClick={showInstallSteps}>
          Как установить
        </Button>
      </Banner>
    );
  }
}
```

**Файлы:**
- Изменить: `src/components/UI/IOSInstallInstructions.tsx`
- Добавить в: `src/pages/SettingsPage.tsx` (секция уведомлений)

---

#### P8-3: Periodic Background Sync для Android

**Приоритет:** СРЕДНИЙ
**Сложность:** Средняя

**Описание:** Использовать Periodic Background Sync API для Android PWA.

```typescript
// sw.ts - добавить
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sync-reading-progress') {
    event.waitUntil(syncReadingProgress());
  }
});

// Registration
async function registerPeriodicSync() {
  const registration = await navigator.serviceWorker.ready;
  if ('periodicSync' in registration) {
    try {
      await registration.periodicSync.register('sync-reading-progress', {
        minInterval: 24 * 60 * 60 * 1000, // 24 часа
      });
    } catch (e) {
      console.log('Periodic Sync not available');
    }
  }
}
```

**Файлы:**
- Изменить: `src/sw.ts`
- Изменить: `src/utils/serviceWorker.ts`

---

#### P8-4: Wake Lock интеграция в Reader

**Приоритет:** СРЕДНИЙ
**Сложность:** Низкая

**Описание:** Интегрировать Wake Lock API в EpubReader для предотвращения выключения экрана.

```typescript
// EpubReader.tsx
function EpubReader() {
  const { request, release, isActive, isSupported } = useWakeLock();
  const [keepScreenOn, setKeepScreenOn] = useState(
    localStorage.getItem('reader-wake-lock') !== 'false'
  );

  useEffect(() => {
    if (keepScreenOn && isSupported) {
      request();
      return () => release();
    }
  }, [keepScreenOn, isSupported]);

  // В настройках Reader
  <Toggle
    label="Не выключать экран"
    checked={keepScreenOn}
    onChange={setKeepScreenOn}
  />
}
```

**Файлы:**
- Изменить: `src/components/Reader/EpubReader.tsx`
- Изменить: `src/components/Reader/ReaderSettingsPanel.tsx`

---

#### P8-5: Content-Index API (опционально)

**Приоритет:** НИЗКИЙ
**Сложность:** Средняя

**Описание:** Индексация offline контента для показа в системном UI.

```typescript
// Регистрация offline книги в Content Index
async function addToContentIndex(book: Book) {
  if (!('index' in registration)) return;

  await registration.index.add({
    id: book.id,
    title: book.title,
    description: `${book.author} - ${book.genre}`,
    category: 'article',
    icons: [{
      src: book.coverUrl || '/icons/book-placeholder.png',
      sizes: '192x192',
      type: 'image/png',
    }],
    url: `/reader/${book.id}`,
  });
}
```

**Примечание:** Поддерживается только в Chrome/Edge Android.

---

### 6.2 Приоритизация и статус P8

| ID | Задача | Приоритет | Сложность | Статус |
|----|--------|-----------|-----------|--------|
| P8-1 | Storage Quota UI | СРЕДНИЙ | Низкая | ✅ **ЗАВЕРШЕНО** |
| P8-2 | iOS Home Screen Guidance | ВЫСОКИЙ | Низкая | ✅ **ЗАВЕРШЕНО** |
| P8-3 | Periodic Sync Android | СРЕДНИЙ | Средняя | ✅ **ЗАВЕРШЕНО** |
| P8-4 | Wake Lock в Reader | СРЕДНИЙ | Низкая | ✅ **ЗАВЕРШЕНО** |
| P8-5 | Content-Index API | НИЗКИЙ | Средняя | ⏳ Опционально |

> **Обновление 11 января 2026:** P8-1 через P8-4 реализованы в рамках текущей сессии.

---

## 7. Заключение

### 7.1 Общая оценка

Реализация PWA в проекте fancai находится на **высоком уровне** после завершения фаз P0-P7:

- ✅ Критические баги исправлены ("Forever Broken Book", race condition)
- ✅ iOS fallback механизмы реализованы (periodic sync, sendBeacon)
- ✅ Push Notifications корректно работают на iOS 16.4+
- ✅ Современные API интегрированы (Navigation Preload, Wake Lock, Badging)
- ✅ Storage management и quota handling реализованы

### 7.2 Реализованные улучшения P8 (11 января 2026)

По результатам исследования были реализованы следующие улучшения:

1. ✅ **Storage Quota UI** - компонент `StorageQuotaInfo` с progress bar, детальной разбивкой и кнопкой очистки кэша
2. ✅ **iOS Guidance** - компонент `IOSPushGuidance` с объяснением необходимости установки PWA для Push
3. ✅ **Wake Lock в Reader** - интеграция `useWakeLock` с toggle в настройках Reader
4. ✅ **Periodic Sync Android** - handler в sw.ts + авто-регистрация в stores/index.ts

### 7.3 Оставшиеся улучшения (опционально)

- ⏳ **P8-5: Content-Index API** - индексация offline книг (низкий приоритет, только Chrome/Edge Android)

### 7.4 Сравнение с индустриальными стандартами

| Критерий | fancai | Industry Best |
|----------|--------|---------------|
| Offline-first | ✅ | ✅ |
| Background Sync | ✅ (fallback) | ✅ |
| Push Notifications | ✅ | ✅ |
| Error Recovery | ✅ | ✅ |
| Storage Management | ✅ | ✅ |
| iOS Compatibility | ✅ | ✅ |
| Modern APIs | ✅ | ✅ |

**Итог:** PWA реализация в fancai соответствует современным стандартам 2025-2026.

---

## История изменений

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-01-11 | Первоначальная версия отчёта |
| 1.1 | 2026-01-11 | **P8-1/P8-2/P8-3/P8-4 ЗАВЕРШЕНЫ** - обновлены статусы и добавлены детали реализации |

---

**Автор:** Claude Code AI
**Дата создания:** 11 января 2026
**Последнее обновление:** 11 января 2026
