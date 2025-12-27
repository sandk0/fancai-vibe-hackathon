# План Доработок BookReader AI как Приложения для Чтения

**Дата:** 27 декабря 2025
**Цель:** Привести приложение к стандартам Kindle/Google Play Books

---

## Общий Обзор

### Приоритеты

| Уровень | Описание | Срок |
|---------|----------|------|
| **P0 - Критический** | Блокирует нормальное использование | 1-2 дня |
| **P1 - Высокий** | Существенно влияет на UX | 3-5 дней |
| **P2 - Средний** | Улучшения качества | 1-2 недели |
| **P3 - Низкий** | Nice to have | Бэклог |

### Трудозатраты

| Категория | Оценка |
|-----------|--------|
| P0 задачи | ~16 часов |
| P1 задачи | ~24 часа |
| P2 задачи | ~40 часов |
| **Всего** | **~80 часов** |

---

## ФАЗА 1: КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ (P0)

### 1.1 Сохранение Прогресса при Logout

**Проблема:** При истечении refresh token теряется локальная позиция чтения.

**Файл:** `frontend/src/stores/auth.ts`

**Изменения:**

```typescript
// БЫЛО:
logout: async () => {
  await clearAllCaches();
  // ...
}

// СТАЛО:
logout: async () => {
  // 1. Сохранить reading progress для восстановления после re-login
  const readingProgressBackup = await backupAllReadingProgress();
  localStorage.setItem('reading_progress_backup', JSON.stringify({
    data: readingProgressBackup,
    savedAt: Date.now(),
    userId: get().user?.id
  }));

  // 2. Очистить кэши
  await clearAllCaches();
  // ...
}

// Добавить восстановление при login:
login: async (email, password) => {
  // После успешного логина
  const backup = localStorage.getItem('reading_progress_backup');
  if (backup) {
    const { data, userId } = JSON.parse(backup);
    if (userId === response.user.id) {
      await restoreReadingProgress(data);
    }
    localStorage.removeItem('reading_progress_backup');
  }
}
```

**Трудозатраты:** 4 часа

---

### 1.2 Немедленное Сохранение при Закрытии Страницы

**Проблема:** 5-секундный debounce может привести к потере последних изменений.

**Файл:** `frontend/src/hooks/epub/useProgressSync.ts`

**Изменения:**

```typescript
// Добавить флаг для немедленного сохранения
const pendingUpdate = useRef<{cfi: string, progress: number} | null>(null);

// При изменении позиции - сохранять pending данные
useEffect(() => {
  pendingUpdate.current = { cfi: currentCFI, progress };
  // ... существующий debounce код
}, [currentCFI, progress]);

// Улучшенный beforeunload
const handleBeforeUnload = useCallback(() => {
  if (!pendingUpdate.current || !bookId) return;

  // Отменить pending debounce
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current);
  }

  const { cfi, progress } = pendingUpdate.current;
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const url = `${API_URL}/books/${bookId}/progress`;

  // Немедленное сохранение с keepalive
  fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      reading_location_cfi: cfi,
      current_position: Math.round(progress),
      scroll_offset_percent: scrollOffset,
    }),
    keepalive: true,
  });

  // Также сохранить в localStorage как fallback
  localStorage.setItem(`book_${bookId}_progress_backup`, JSON.stringify({
    cfi, progress, scrollOffset, savedAt: Date.now()
  }));
}, [bookId, scrollOffset]);
```

**Трудозатраты:** 3 часа

---

### 1.3 Кнопка "Повторить" при Ошибках

**Проблема:** Нет возможности повторить загрузку при ошибке.

**Файл:** `frontend/src/components/Reader/EpubReader.tsx`

**Изменения:**

```typescript
// Добавить функцию retry
const handleRetry = useCallback(() => {
  setError(null);
  // Сбросить состояние и перезагрузить
  queryClient.invalidateQueries({ queryKey: ['book', book.id] });
}, [book.id, queryClient]);

// Улучшенный Error UI
{error && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 z-50">
    <div className="text-center max-w-md p-6">
      <div className="text-red-400 text-6xl mb-4">📚</div>
      <h3 className="text-xl font-semibold text-white mb-2">
        Не удалось загрузить книгу
      </h3>
      <p className="text-gray-400 mb-6">
        {getHumanReadableError(error)}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={handleRetry}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
        >
          Попробовать снова
        </button>
        <button
          onClick={() => navigate('/library')}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
        >
          В библиотеку
        </button>
      </div>
    </div>
  </div>
)}

// Функция для человекопонятных ошибок
function getHumanReadableError(error: string): string {
  if (error.includes('Network')) {
    return 'Проверьте подключение к интернету и попробуйте снова.';
  }
  if (error.includes('not found') || error.includes('404')) {
    return 'Книга не найдена. Возможно, она была удалена.';
  }
  if (error.includes('Unauthorized') || error.includes('401')) {
    return 'Сессия истекла. Войдите в аккаунт снова.';
  }
  if (error.includes('parse') || error.includes('EPUB')) {
    return 'Файл книги повреждён. Попробуйте загрузить её заново.';
  }
  return 'Произошла ошибка. Попробуйте позже.';
}
```

**Трудозатраты:** 3 часа

---

### 1.4 localStorage Fallback при Ошибке Сохранения

**Проблема:** При ошибке API прогресс теряется.

**Файл:** `frontend/src/hooks/epub/useProgressSync.ts`

**Изменения:**

```typescript
const saveImmediate = async () => {
  try {
    await onSave(currentCFI, progress, scrollOffset, currentChapter);
    lastSavedRef.current = { cfi: currentCFI, progress, scrollOffset };

    // Очистить fallback при успешном сохранении
    localStorage.removeItem(`book_${bookId}_progress_backup`);
  } catch (err) {
    console.error('Error saving progress:', err);

    // Fallback: сохранить в localStorage
    const backupData = {
      reading_location_cfi: currentCFI,
      current_position: Math.round(progress),
      scroll_offset_percent: scrollOffset,
      current_chapter: currentChapter,
      savedAt: Date.now(),
      pendingSync: true, // Флаг для синхронизации позже
    };
    localStorage.setItem(`book_${bookId}_progress_backup`, JSON.stringify(backupData));

    // Добавить в очередь синхронизации
    addToSyncQueue('progress', bookId, backupData);
  }
};
```

**Трудозатраты:** 2 часа

---

### 1.5 Индикатор Сохранения Позиции

**Проблема:** Пользователь не знает, сохранилась ли позиция.

**Файл:** Создать `frontend/src/components/Reader/ProgressSaveIndicator.tsx`

**Код:**

```typescript
import { useEffect, useState } from 'react';

interface Props {
  lastSaved: number | null;
  isSaving: boolean;
}

export function ProgressSaveIndicator({ lastSaved, isSaving }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (lastSaved) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaved]);

  if (!visible && !isSaving) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-gray-800/90 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2">
        {isSaving ? (
          <>
            <span className="animate-spin">⏳</span>
            Сохранение...
          </>
        ) : (
          <>
            <span className="text-green-400">✓</span>
            Позиция сохранена
          </>
        )}
      </div>
    </div>
  );
}
```

**Трудозатраты:** 2 часа

---

## ФАЗА 2: ВАЖНЫЕ УЛУЧШЕНИЯ (P1)

### 2.1 Синхронизация при Открытии Книги

**Проблема:** Нет проверки серверной позиции при открытии.

**Файл:** `frontend/src/components/Reader/EpubReader.tsx`

**Изменения:**

```typescript
// Добавить состояние для конфликта
const [positionConflict, setPositionConflict] = useState<{
  serverPosition: ReadingProgress;
  localPosition: ReadingProgress;
} | null>(null);

// При инициализации - сравнивать позиции
const initializePosition = async () => {
  const serverProgress = await booksAPI.getReadingProgress(book.id);

  // Проверить localStorage backup
  const localBackup = localStorage.getItem(`book_${book.id}_progress_backup`);

  if (localBackup) {
    const localProgress = JSON.parse(localBackup);

    // Если разница > 5% - показать диалог
    const serverPercent = serverProgress?.current_position || 0;
    const localPercent = localProgress.current_position || 0;

    if (Math.abs(serverPercent - localPercent) > 5) {
      setPositionConflict({
        serverPosition: serverProgress,
        localPosition: localProgress,
      });
      return; // Подождать выбора пользователя
    }
  }

  // Использовать серверную позицию
  if (serverProgress?.reading_location_cfi) {
    await goToCFI(serverProgress.reading_location_cfi);
  }
};

// Компонент диалога конфликта
{positionConflict && (
  <PositionConflictDialog
    serverPosition={positionConflict.serverPosition}
    localPosition={positionConflict.localPosition}
    onUseServer={() => {
      goToCFI(positionConflict.serverPosition.reading_location_cfi);
      setPositionConflict(null);
    }}
    onUseLocal={() => {
      goToCFI(positionConflict.localPosition.reading_location_cfi);
      setPositionConflict(null);
    }}
  />
)}
```

**Трудозатраты:** 6 часов

---

### 2.2 Offline Status Hook и Banner

**Проблема:** Пользователь не знает, что он offline.

**Файл:** Создать `frontend/src/hooks/useOnlineStatus.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean; // Был ли offline с момента загрузки
  lastOnlineAt: number | null;
}

export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>({
    isOnline: navigator.onLine,
    wasOffline: false,
    lastOnlineAt: navigator.onLine ? Date.now() : null,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({
        isOnline: true,
        wasOffline: prev.wasOffline,
        lastOnlineAt: Date.now(),
      }));

      // Триггерить синхронизацию очереди
      processSyncQueue();
    };

    const handleOffline = () => {
      setStatus(prev => ({
        isOnline: false,
        wasOffline: true,
        lastOnlineAt: prev.lastOnlineAt,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return status;
}
```

**Файл:** Создать `frontend/src/components/UI/OfflineBanner.tsx`

```typescript
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm
      ${isOnline ? 'bg-green-600' : 'bg-yellow-600'}`}>
      {isOnline ? (
        <>✓ Соединение восстановлено. Синхронизация...</>
      ) : (
        <>📡 Вы offline. Изменения сохранятся при восстановлении связи.</>
      )}
    </div>
  );
}
```

**Трудозатраты:** 4 часа

---

### 2.3 Очередь Синхронизации (Sync Queue)

**Проблема:** Операции теряются при отсутствии сети.

**Файл:** Создать `frontend/src/services/syncQueue.ts`

```typescript
const SYNC_QUEUE_KEY = 'sync_queue';

interface SyncOperation {
  id: string;
  type: 'progress' | 'bookmark' | 'highlight';
  bookId: string;
  data: any;
  createdAt: number;
  retries: number;
}

class SyncQueueService {
  private queue: SyncOperation[] = [];

  constructor() {
    this.loadFromStorage();
    this.setupNetworkListener();
  }

  private loadFromStorage() {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY);
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }

  private saveToStorage() {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
  }

  add(type: SyncOperation['type'], bookId: string, data: any) {
    const operation: SyncOperation = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      bookId,
      data,
      createdAt: Date.now(),
      retries: 0,
    };

    this.queue.push(operation);
    this.saveToStorage();

    // Попробовать синхронизировать сразу если online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue() {
    const pending = [...this.queue];

    for (const op of pending) {
      try {
        await this.executeOperation(op);
        // Удалить из очереди при успехе
        this.queue = this.queue.filter(o => o.id !== op.id);
        this.saveToStorage();
      } catch (error) {
        op.retries++;
        if (op.retries >= 3) {
          // Слишком много попыток - удалить
          this.queue = this.queue.filter(o => o.id !== op.id);
        }
        this.saveToStorage();
      }
    }
  }

  private async executeOperation(op: SyncOperation) {
    switch (op.type) {
      case 'progress':
        await booksAPI.updateProgress(op.bookId, op.data);
        break;
      case 'bookmark':
        await booksAPI.addBookmark(op.bookId, op.data);
        break;
      // ... другие типы
    }
  }

  private setupNetworkListener() {
    window.addEventListener('online', () => {
      console.log('🔄 Network restored, processing sync queue...');
      this.processQueue();
    });
  }
}

export const syncQueue = new SyncQueueService();
export const addToSyncQueue = syncQueue.add.bind(syncQueue);
export const processSyncQueue = syncQueue.processQueue.bind(syncQueue);
```

**Трудозатраты:** 6 часов

---

### 2.4 Кэширование EPUB Файлов

**Проблема:** EPUB скачивается при каждом открытии книги.

**Файл:** Создать `frontend/src/services/epubFileCache.ts`

```typescript
const DB_NAME = 'BookReaderEpubCache';
const STORE_NAME = 'epub_files';
const MAX_CACHED_BOOKS = 20; // Максимум 20 книг в кэше

interface CachedEpub {
  bookId: string;
  data: ArrayBuffer;
  size: number;
  cachedAt: number;
  lastAccessedAt: number;
}

class EpubFileCacheService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
        }
      };
    });
  }

  async get(bookId: string): Promise<ArrayBuffer | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onsuccess = () => {
        const result = request.result as CachedEpub | undefined;
        if (result) {
          // Обновить lastAccessedAt
          result.lastAccessedAt = Date.now();
          store.put(result);
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async set(bookId: string, data: ArrayBuffer): Promise<void> {
    if (!this.db) await this.init();

    // Проверить лимит и очистить старые
    await this.ensureSpace();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const cached: CachedEpub = {
        bookId,
        data,
        size: data.byteLength,
        cachedAt: Date.now(),
        lastAccessedAt: Date.now(),
      };

      const request = store.put(cached);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async ensureSpace(): Promise<void> {
    // Получить все записи и удалить старые если превышен лимит
    // ... LRU cleanup logic
  }
}

export const epubFileCache = new EpubFileCacheService();
```

**Использование в useEpubLoader:**

```typescript
// useEpubLoader.ts
const loadBook = async (bookUrl: string, bookId: string) => {
  // 1. Проверить кэш
  let epubData = await epubFileCache.get(bookId);

  if (!epubData) {
    // 2. Скачать и закэшировать
    const response = await fetch(bookUrl);
    epubData = await response.arrayBuffer();
    await epubFileCache.set(bookId, epubData);
  }

  // 3. Загрузить epub.js
  const book = ePub(epubData);
  // ...
};
```

**Трудозатраты:** 8 часов

---

## ФАЗА 3: УЛУЧШЕНИЯ КАЧЕСТВА (P2)

### 3.1 Web Worker для Location Generation

**Проблема:** Блокировка UI на больших книгах.

**Трудозатраты:** 8 часов

### 3.2 Retry с Exponential Backoff

**Проблема:** Нет автоматических повторов при временных ошибках.

**Трудозатраты:** 4 часа

### 3.3 Server-side Location Pre-generation

**Проблема:** Медленная первая загрузка больших книг.

**Трудозатраты:** 16 часов

### 3.4 Service Worker для Полного Offline

**Проблема:** Нет полноценного offline режима.

**Трудозатраты:** 12 часов

---

## ФАЗА 4: ДОЛГОСРОЧНЫЕ УЛУЧШЕНИЯ (P3)

### 4.1 WebSocket для Real-time Sync

Для Premium/Ultimate подписок.

### 4.2 Кнопка "Скачать для Offline"

Скачать всю книгу с изображениями.

### 4.3 Push Notifications для Sync

Уведомления о синхронизации между устройствами.

---

## Порядок Выполнения

```
Неделя 1:
├── [P0] 1.1 Сохранение прогресса при logout (4ч)
├── [P0] 1.2 Немедленное сохранение при закрытии (3ч)
├── [P0] 1.3 Кнопка "Повторить" (3ч)
├── [P0] 1.4 localStorage fallback (2ч)
└── [P0] 1.5 Индикатор сохранения (2ч)

Неделя 2:
├── [P1] 2.1 Sync on open (6ч)
├── [P1] 2.2 Offline status hook (4ч)
├── [P1] 2.3 Sync queue (6ч)
└── [P1] 2.4 EPUB file cache (8ч)

Неделя 3-4:
├── [P2] 3.1 Web Worker (8ч)
├── [P2] 3.2 Exponential backoff (4ч)
├── [P2] 3.3 Server-side locations (16ч)
└── [P2] 3.4 Service Worker (12ч)
```

---

## Метрики Успеха

После реализации P0 и P1:

| Метрика | Было | Цель |
|---------|------|------|
| Потеря прогресса при logout | 100% | 0% |
| Потеря прогресса при offline | 50% | 5% |
| Cross-device sync | Нет | Да |
| User awareness of save status | 0% | 100% |
| Retry возможность при ошибках | Нет | Да |

---

*План составлен на основе анализа best practices Kindle, Google Play Books, LitRes и Bookmate.*
