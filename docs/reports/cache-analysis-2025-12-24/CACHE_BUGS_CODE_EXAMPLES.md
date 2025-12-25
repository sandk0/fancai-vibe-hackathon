# 🐛 TanStack Query Cache Bugs - Code Examples

**Companion to:** TANSTACK_QUERY_CACHE_ANALYSIS.md
**Purpose:** Конкретные примеры кода с ошибками и правильными реализациями

---

## 🔴 CRITICAL BUG #1: User-Specific Data Leakage

### ❌ ТЕКУЩИЙ КОД (НЕПРАВИЛЬНО):

**Файл:** `frontend/src/pages/HomePage.tsx:44`
```typescript
const { data: readingStats } = useQuery({
  queryKey: ['userReadingStatistics'],  // ❌ НЕТ userId!
  queryFn: () => booksAPI.getUserReadingStatistics(),
  staleTime: 30000,
});
```

**Файл:** `frontend/src/pages/StatsPage.tsx:38`
```typescript
const { data: detailedStats } = useQuery({
  queryKey: ['user-reading-statistics'],  // ❌ НЕТ userId! + ДРУГОЙ формат
  queryFn: () => booksAPI.getUserReadingStatistics(),
});
```

**Файл:** `frontend/src/pages/ProfilePage.tsx:59`
```typescript
const { data: statsData } = useQuery({
  queryKey: ['user-statistics'],  // ❌ НЕТ userId! + ЕЩЕ ОДИН формат!
  queryFn: () => booksAPI.getUserStatistics(),
});
```

### 🧪 КАК ВОСПРОИЗВЕСТИ БАГ:

```typescript
// Scenario:
// 1. User A (id='user-a') логинится
// 2. Открывает HomePage → загружается статистика User A
// 3. TanStack Query кэширует:
queryCache = {
  ['userReadingStatistics']: {
    data: { total_books: 50, total_reading_time: 3000 },
    // ❌ ПРОБЛЕМА: нет привязки к userId!
  }
}

// 4. User A делает logout
// 5. cacheManager.clearAllCaches() очищает queryClient.clear()
//    НО если есть race condition или ошибка - кэш может остаться

// 6. User B (id='user-b') логинится
// 7. Открывает HomePage
// 8. ❌ BUG: Может увидеть кэшированные данные User A!
//    Потому что queryKey одинаковый: ['userReadingStatistics']
```

### ✅ ПРАВИЛЬНЫЙ КОД:

**Шаг 1:** Создать `userKeys` в `queryKeys.ts`:

```typescript
// frontend/src/hooks/api/queryKeys.ts

export const userKeys = {
  /**
   * Базовый ключ для всех user queries
   */
  all: ['user'] as const,

  /**
   * Данные текущего пользователя
   * @param userId - ID пользователя
   */
  current: (userId: string) => [...userKeys.all, userId] as const,

  /**
   * Статистика чтения пользователя
   * @param userId - ID пользователя
   */
  statistics: (userId: string) =>
    [...userKeys.all, userId, 'statistics'] as const,

  /**
   * Детальная статистика чтения (для StatsPage)
   * @param userId - ID пользователя
   */
  readingStats: (userId: string) =>
    [...userKeys.all, userId, 'reading-stats'] as const,

  /**
   * Статистика по изображениям
   * @param userId - ID пользователя
   */
  imageStats: (userId: string) =>
    [...userKeys.all, userId, 'image-stats'] as const,
};
```

**Шаг 2:** Обновить HomePage:

```typescript
// frontend/src/pages/HomePage.tsx

import { userKeys } from '@/hooks/api/queryKeys';

const HomePage: React.FC = () => {
  const { user } = useAuthStore();  // ✅ Получаем user

  // Fetch user reading statistics
  const { data: readingStats } = useQuery({
    queryKey: userKeys.readingStats(user?.id || ''),  // ✅ userId в ключе!
    queryFn: () => booksAPI.getUserReadingStatistics(),
    staleTime: 30000,
    enabled: !!user?.id,  // ✅ Не загружать если нет user
  });

  // Fetch books
  const { data: booksData } = useQuery({
    // ✅ Добавляем userId в конец для изоляции
    queryKey: [...bookKeys.list({ limit: 50, sort_by: 'accessed_desc' }), user?.id],
    queryFn: () => booksAPI.getBooks({ limit: 50, sort_by: 'accessed_desc' }),
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !!user?.id,
  });

  // Fetch user images stats
  const { data: imagesStats } = useQuery({
    queryKey: userKeys.imageStats(user?.id || ''),  // ✅ userId в ключе!
    queryFn: () => imagesAPI.getUserStats(),
    staleTime: 30000,
    enabled: !!user?.id,
  });

  // ... rest of component
};
```

**Шаг 3:** Обновить StatsPage:

```typescript
// frontend/src/pages/StatsPage.tsx

const StatsPage: React.FC = () => {
  const { user } = useAuthStore();

  const { data: detailedStats, isLoading, error } = useQuery({
    queryKey: userKeys.readingStats(user?.id || ''),  // ✅ Используем userKeys!
    queryFn: () => booksAPI.getUserReadingStatistics(),
    enabled: !!user?.id,
  });

  const { data: booksData, isLoading: booksLoading } = useQuery({
    // ✅ User-specific books list
    queryKey: [...bookKeys.list({ skip: 0, limit: 100 }), user?.id],
    queryFn: () => booksAPI.getBooks({ skip: 0, limit: 100 }),
    enabled: !!user?.id,
  });

  // ... rest
};
```

**Шаг 4:** Обновить ProfilePage:

```typescript
// frontend/src/pages/ProfilePage.tsx

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();

  const { data: statsData, isLoading } = useQuery({
    queryKey: userKeys.statistics(user?.id || ''),  // ✅ Используем userKeys!
    queryFn: () => booksAPI.getUserStatistics(),
    enabled: !!user?.id,
  });

  // ... rest
};
```

### 🧪 ТЕСТИРОВАНИЕ FIX:

```typescript
// После fix:
// 1. User A (id='user-a') логинится
// 2. Открывает HomePage
queryCache = {
  ['user', 'user-a', 'reading-stats']: { data: {...} },  // ✅ userId в ключе!
  ['books', 'list', {...}, 'user-a']: { data: {...} },
}

// 3. User A делает logout
// 4. clearAllCaches() → queryClient.clear()
queryCache = {}  // ✅ Все очищено

// 5. User B (id='user-b') логинится
// 6. Открывает HomePage
queryCache = {
  ['user', 'user-b', 'reading-stats']: { data: {...} },  // ✅ НОВЫЙ кэш для User B!
  ['books', 'list', {...}, 'user-b']: { data: {...} },
}

// ✅ SUCCESS: User B видит только свои данные!
```

---

## 🔴 CRITICAL BUG #2: bookKeys.list() Partial Matching Failed

### ❌ ТЕКУЩИЙ КОД (НЕПРАВИЛЬНО):

**Файл:** `frontend/src/hooks/api/useBooks.ts:324-373`

```typescript
export function useDeleteBook(options?: ...) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookId: string) => booksAPI.deleteBook(bookId),

    onMutate: async (bookId) => {
      // ❌ ПРОБЛЕМА: bookKeys.list() возвращает ['books', 'list', undefined]
      await queryClient.cancelQueries({ queryKey: bookKeys.list() });

      // ❌ Получаем данные из НЕПРАВИЛЬНОГО ключа
      const previousBooks = queryClient.getQueryData(bookKeys.list());

      // ❌ Обновляем НЕПРАВИЛЬНЫЙ ключ
      queryClient.setQueriesData<{ books: Book[]; ... }>(
        { queryKey: bookKeys.list() },  // ['books', 'list', undefined]
        (old) => {
          if (!old) return old;
          return {
            ...old,
            books: old.books.filter((book) => book.id !== bookId),
            total: old.total - 1,
          };
        }
      );

      return { previousBooks };
    },

    onSuccess: async (_data, bookId) => {
      // ... cache cleanup ...

      // ❌ Инвалидация НЕПРАВИЛЬНЫХ ключей
      queryKeyUtils.invalidateAfterDelete(bookId).forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },

    onError: (_error, _bookId, context) => {
      if (context?.previousBooks) {
        // ❌ Rollback в НЕПРАВИЛЬНЫЙ ключ
        queryClient.setQueryData(bookKeys.list(), context.previousBooks);
      }
    },
  });
}
```

**Файл:** `frontend/src/hooks/api/queryKeys.ts:26-27`

```typescript
export const bookKeys = {
  all: ['books'] as const,

  // ✅ Эта функция правильная
  list: (params?: { skip?: number; limit?: number; sort_by?: string }) =>
    [...bookKeys.all, 'list', params] as const,

  // ... остальные ключи ...
};
```

**Фактическое использование:**

```typescript
// В LibraryPage:
const { data } = useBooks(
  { skip: 0, limit: 10, sort_by: 'created_desc' },  // ✅ params передаются
  {...}
);

// Это создает query с ключом:
// ['books', 'list', { skip: 0, limit: 10, sort_by: 'created_desc' }]

// НО в useDeleteBook используется:
queryClient.cancelQueries({ queryKey: bookKeys.list() });
// Это ищет query с ключом:
// ['books', 'list', undefined]

// ❌ MISMATCH! Queries не найдены!
```

### 🧪 КАК ВОСПРОИЗВЕСТИ БАГ:

```typescript
// 1. Открыть LibraryPage
// 2. Загружаются книги с queryKey: ['books', 'list', { skip: 0, limit: 10, sort_by: 'created_desc' }]
// 3. Кликнуть "Delete" на книге
// 4. useDeleteBook.onMutate выполняется:
await queryClient.cancelQueries({ queryKey: ['books', 'list', undefined] });
// ❌ Не находит query (ключ не совпадает)
// ❌ cancelQueries ничего не делает

queryClient.setQueriesData({ queryKey: ['books', 'list', undefined] }, ...);
// ❌ Не находит query
// ❌ setQueriesData ничего не обновляет

// 5. ❌ BUG: UI не обновляется (книга остается в списке)
// 6. onSuccess выполняется, invalidateQueries триггерит refetch
// 7. ✅ ТОЛЬКО ПОСЛЕ REFETCH книга исчезает
```

### ✅ ПРАВИЛЬНЫЙ КОД:

**Option 1: Использовать bookKeys.all для partial matching**

```typescript
// frontend/src/hooks/api/useBooks.ts

export function useDeleteBook(options?: ...) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookId: string) => booksAPI.deleteBook(bookId),

    onMutate: async (bookId) => {
      // ✅ FIX: Используем bookKeys.all для partial match
      await queryClient.cancelQueries({ queryKey: bookKeys.all });

      // ✅ Получаем ВСЕ books queries
      const previousQueries = queryClient.getQueriesData({ queryKey: bookKeys.all });

      // ✅ Обновляем ВСЕ books list queries
      queryClient.setQueriesData<{
        books: Book[];
        total: number;
        skip: number;
        limit: number;
      }>(
        { queryKey: bookKeys.all, exact: false },  // ✅ Partial match!
        (old) => {
          if (!old || !old.books) return old;  // ✅ Type guard
          return {
            ...old,
            books: old.books.filter((book) => book.id !== bookId),
            total: old.total - 1,
          };
        }
      );

      return { previousQueries };
    },

    onSuccess: async (_data, bookId) => {
      // Cleanup caches
      await Promise.all([
        chapterCache.clearBook(bookId),
        imageCache.clearBook(bookId),
      ]).catch(console.warn);

      // ✅ FIX: Инвалидация с правильными ключами
      await queryClient.invalidateQueries({
        queryKey: bookKeys.all,  // ✅ Матчит все ['books', ...]
        refetchType: 'active',
      });
    },

    onError: (_error, _bookId, context) => {
      // ✅ Rollback ВСЕ queries
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
  });
}
```

**Option 2: Использовать predicate function (более точный контроль)**

```typescript
onMutate: async (bookId) => {
  // ✅ Cancel только books list queries
  await queryClient.cancelQueries({
    predicate: (query) => {
      const key = query.queryKey;
      return key[0] === 'books' && key[1] === 'list';
    },
  });

  // Snapshot
  const previousQueries = queryClient.getQueriesData({
    predicate: (query) => {
      const key = query.queryKey;
      return key[0] === 'books' && key[1] === 'list';
    },
  });

  // Update
  queryClient.setQueriesData<{ books: Book[]; ... }>(
    {
      predicate: (query) => {
        const key = query.queryKey;
        return key[0] === 'books' && key[1] === 'list';
      },
    },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        books: old.books.filter((book) => book.id !== bookId),
        total: old.total - 1,
      };
    }
  );

  return { previousQueries };
},
```

**Обновить queryKeyUtils:**

```typescript
// frontend/src/hooks/api/queryKeys.ts

export const queryKeyUtils = {
  invalidateAfterDelete: (bookId: string) => [
    bookKeys.all,  // ✅ FIX: Changed from bookKeys.list()
    bookKeys.statistics(),
    chapterKeys.byBook(bookId),
    descriptionKeys.byBook(bookId),
    imageKeys.byBook(bookId),
  ],
};
```

### 🧪 ТЕСТИРОВАНИЕ FIX:

```typescript
// После fix:
// 1. LibraryPage загружает книги
queryCache = {
  ['books', 'list', { skip: 0, limit: 10, sort_by: 'created_desc' }]: {
    data: { books: [book1, book2, book3], total: 3 }
  }
}

// 2. Delete book2
// 3. onMutate выполняется:
await queryClient.cancelQueries({ queryKey: ['books'] });
// ✅ FINDS query: ['books', 'list', {...}] (partial match)

queryClient.setQueriesData({ queryKey: ['books'], exact: false }, (old) => {
  return {
    ...old,
    books: [book1, book3],  // ✅ book2 удалена
    total: 2
  };
});
// ✅ UPDATES query!

// 4. ✅ SUCCESS: UI сразу показывает 2 книги (optimistic update)
// 5. onSuccess триггерит refetch для подтверждения
// 6. ✅ Если delete успешен - UI остается (2 книги)
// 7. ✅ Если delete failed - onError rollback восстанавливает book2
```

---

## 🔴 CRITICAL BUG #3: setQueriesData в useUpdateReadingProgress

### ❌ ТЕКУЩИЙ КОД (НЕПРАВИЛЬНО):

**Файл:** `frontend/src/hooks/api/useBooks.ts:444-483`

```typescript
export function useUpdateReadingProgress(options?: ...) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookId, ...data }) =>
      booksAPI.updateReadingProgress(bookId, data),

    onMutate: async ({ bookId, ...newProgress }) => {
      // Optimistic update для progress
      await queryClient.cancelQueries({ queryKey: bookKeys.progress(bookId) });

      const previousProgress = queryClient.getQueryData(bookKeys.progress(bookId));

      queryClient.setQueryData(bookKeys.progress(bookId), {
        progress: {
          book_id: bookId,
          current_chapter: newProgress.current_chapter,
          current_position: newProgress.current_position_percent,
          // ... rest
        },
      });

      return { previousProgress };
    },

    onSuccess: (data, variables) => {
      // ✅ Update progress cache
      queryClient.setQueryData(bookKeys.progress(variables.bookId), data);

      // ✅ Update book detail
      queryClient.setQueryData<BookDetail>(
        bookKeys.detail(variables.bookId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            reading_progress: {
              ...old.reading_progress,
              current_chapter: data.progress.current_chapter,
              // ... update progress fields
            },
          };
        }
      );

      // ❌ ПРОБЛЕМА 1: bookKeys.list() не матчит bookKeys.list(params)
      queryClient.setQueriesData<{
        books: Book[];
        total: number;
        skip: number;
        limit: number;
      }>({ queryKey: bookKeys.list() }, (old) => {  // ❌ ['books', 'list', undefined]
        if (!old) return old;
        return {
          ...old,
          books: old.books.map((book) =>
            book.id === variables.bookId
              ? { ...book, reading_progress_percent: data.progress.progress_percent }
              : book
          ),
        };
      });

      // ❌ ПРОБЛЕМА 2: НЕТ invalidation для statistics!
      // После чтения статистика не обновляется:
      // - total_reading_time_minutes
      // - total_chapters_read
      // - reading_streak_days
    },

    onError: (_error, variables, context) => {
      if (context?.previousProgress) {
        queryClient.setQueryData(
          bookKeys.progress(variables.bookId),
          context.previousProgress
        );
      }
    },
  });
}
```

### 🧪 КАК ВОСПРОИЗВЕСТИ БАГ:

```typescript
// Scenario 1: Books list не обновляется
// 1. LibraryPage показывает книги
queryCache = {
  ['books', 'list', { skip: 0, limit: 10, sort_by: 'created_desc' }]: {
    data: {
      books: [
        { id: 'book1', reading_progress_percent: 0 },
        { id: 'book2', reading_progress_percent: 50 },
      ]
    }
  }
}

// 2. Открыть book1 reader, прочитать до 25%
// 3. useUpdateReadingProgress.onSuccess выполняется:
queryClient.setQueriesData({ queryKey: ['books', 'list', undefined] }, (old) => {
  return {
    ...old,
    books: old.books.map(book =>
      book.id === 'book1'
        ? { ...book, reading_progress_percent: 25 }
        : book
    ),
  };
});
// ❌ Не находит query (ключ не совпадает)

// 4. Закрыть reader, вернуться на LibraryPage
// 5. ❌ BUG: book1 все еще показывает 0% (не обновилось)

// =========================================================

// Scenario 2: Statistics не обновляется
// 1. HomePage показывает statistics
queryCache = {
  ['userReadingStatistics']: {
    data: {
      total_books: 5,
      total_reading_time_minutes: 300,
      total_chapters_read: 50,
    }
  }
}

// 2. Прочитать главу (5 минут)
// 3. useUpdateReadingProgress.onSuccess выполняется
// ❌ НЕТ invalidation для statistics!

// 4. Перейти на HomePage
// 5. ❌ BUG: Statistics shows old data (300 minutes, not 305)
// 6. Только после manual refresh обновляется
```

### ✅ ПРАВИЛЬНЫЙ КОД:

**Option 1: Инвалидация вместо ручного обновления (РЕКОМЕНДУЕТСЯ)**

```typescript
// frontend/src/hooks/api/useBooks.ts

export function useUpdateReadingProgress(options?: ...) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookId, ...data }) =>
      booksAPI.updateReadingProgress(bookId, data),

    onMutate: async ({ bookId, ...newProgress }) => {
      // Cancel queries
      await queryClient.cancelQueries({ queryKey: bookKeys.progress(bookId) });

      const previousProgress = queryClient.getQueryData(bookKeys.progress(bookId));

      // Optimistic update
      queryClient.setQueryData(bookKeys.progress(bookId), {
        progress: {
          book_id: bookId,
          current_chapter: newProgress.current_chapter,
          current_position: newProgress.current_position_percent,
          reading_location_cfi: newProgress.reading_location_cfi,
          scroll_offset_percent: newProgress.scroll_offset_percent,
          progress_percent: 0,  // Will be calculated on backend
          current_page: 0,
          last_read_at: new Date().toISOString(),
        },
      });

      return { previousProgress };
    },

    onSuccess: async (data, variables) => {
      // ✅ Update progress cache with real data
      queryClient.setQueryData(bookKeys.progress(variables.bookId), data);

      // ✅ FIX: Invalidate instead of manual update
      await queryClient.invalidateQueries({
        queryKey: bookKeys.all,
        refetchType: 'active',  // Only refetch active queries
      });

      // ✅ FIX: Invalidate statistics
      await queryClient.invalidateQueries({
        queryKey: bookKeys.statistics(),
        refetchType: 'active',
      });

      // ✅ BONUS: Invalidate user stats (если добавили userKeys)
      const { user } = useAuthStore.getState();
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: userKeys.all,
          refetchType: 'active',
        });
      }
    },

    onError: (_error, variables, context) => {
      if (context?.previousProgress) {
        queryClient.setQueryData(
          bookKeys.progress(variables.bookId),
          context.previousProgress
        );
      }
    },
  });
}
```

**Option 2: Правильный ручной update (если хотим избежать refetch)**

```typescript
onSuccess: (data, variables) => {
  // Update progress
  queryClient.setQueryData(bookKeys.progress(variables.bookId), data);

  // Update book detail
  queryClient.setQueryData<BookDetail>(
    bookKeys.detail(variables.bookId),
    (old) => {
      if (!old) return old;
      return {
        ...old,
        reading_progress: {
          ...old.reading_progress,
          current_chapter: data.progress.current_chapter,
          current_position: data.progress.current_position,
          reading_location_cfi: data.progress.reading_location_cfi,
          progress_percent: data.progress.progress_percent,
        },
      };
    }
  );

  // ✅ FIX: Update ALL books list queries (partial match)
  queryClient.setQueriesData<{
    books: Book[];
    total: number;
    skip: number;
    limit: number;
  }>(
    { queryKey: bookKeys.all, exact: false },  // ✅ Partial match!
    (old) => {
      if (!old || !old.books) return old;
      return {
        ...old,
        books: old.books.map((book) =>
          book.id === variables.bookId
            ? {
                ...book,
                reading_progress_percent: data.progress.progress_percent,
                last_accessed_at: new Date().toISOString(),
              }
            : book
        ),
      };
    }
  );

  // ✅ FIX: Update statistics manually
  queryClient.setQueriesData<UserReadingStatistics>(
    { queryKey: bookKeys.statistics() },
    (old) => {
      if (!old) return old;

      // Calculate new reading time
      const newReadingTime = old.total_reading_time_minutes +
        (data.progress.reading_session_duration_minutes || 0);

      return {
        ...old,
        total_reading_time_minutes: newReadingTime,
        total_chapters_read: old.total_chapters_read + 1,
        last_reading_session: new Date().toISOString(),
      };
    }
  );
},
```

### 🧪 ТЕСТИРОВАНИЕ FIX:

```typescript
// После fix (Option 1 - с invalidation):
// 1. Прочитать главу книги
// 2. onSuccess выполняется:
await queryClient.invalidateQueries({ queryKey: ['books'], refetchType: 'active' });
// ✅ Refetch ALL active books queries (list, detail, etc.)

await queryClient.invalidateQueries({ queryKey: ['books', 'statistics'] });
// ✅ Refetch statistics

// 3. ✅ SUCCESS:
// - LibraryPage показывает новый progress (25%)
// - HomePage statistics обновляется (305 minutes)
// - Все queries в sync

// =========================================================

// После fix (Option 2 - с ручным update):
// 1. Прочитать главу книги
// 2. onSuccess выполняется:
queryClient.setQueriesData({ queryKey: ['books'], exact: false }, (old) => {
  return {
    ...old,
    books: old.books.map(book =>
      book.id === 'book1'
        ? { ...book, reading_progress_percent: 25 }
        : book
    ),
  };
});
// ✅ FINDS and UPDATES query!

queryClient.setQueriesData({ queryKey: ['books', 'statistics'] }, (old) => {
  return {
    ...old,
    total_reading_time_minutes: old.total_reading_time_minutes + 5,
  };
});
// ✅ UPDATES statistics!

// 3. ✅ SUCCESS:
// - Instant UI update (no refetch)
// - All queries in sync
```

---

## 📚 SUMMARY

**3 CRITICAL BUGS проанализированы:**
1. ✅ User-specific data leakage - ПОЛНЫЙ FIX
2. ✅ bookKeys.list() partial matching - ПОЛНЫЙ FIX
3. ✅ useUpdateReadingProgress missing updates - ПОЛНЫЙ FIX

**Каждый fix включает:**
- ❌ Текущий код (неправильный)
- 🧪 Как воспроизвести баг
- ✅ Правильный код (multiple options)
- 🧪 Как проверить fix

**Следующие шаги:**
1. Применить fixes из этого документа
2. Написать unit tests для каждого scenario
3. Manual QA testing по описанным scenarios
4. Обновить documentation (CLAUDE.md)

---

**Generated by:** Frontend Developer Agent v2.0
**Companion to:** TANSTACK_QUERY_CACHE_ANALYSIS.md
