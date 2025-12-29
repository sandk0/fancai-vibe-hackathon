# Анализ несоответствия счетчиков книг

**Дата:** 29 декабря 2025

---

## 1. Источники данных

### HomePage (Главная страница)

**Источник:** `GET /api/v1/users/reading-statistics`

```typescript
const totalBooks = readingStats?.total_books ?? 0;
```

**Логика backend:** `SELECT COUNT(*) FROM books WHERE user_id = ?`

### LibraryPage (Библиотека)

**Источник 1:** `GET /api/v1/books/` → `data.total`

**Источник 2:** Локальный расчёт из `books` (текущая страница):
```typescript
// useLibraryFilters.ts:47-66
const booksInProgress = books.filter(b =>
  b.reading_progress_percent > 0 &&
  b.reading_progress_percent < 100
).length;

const booksCompleted = books.filter(b =>
  b.reading_progress_percent === 100
).length;
```

---

## 2. Причины расхождений

### P1: Статистика из текущей страницы (ГЛАВНАЯ ПРОБЛЕМА)

LibraryPage считает `booksInProgress` и `booksCompleted` из 10 книг текущей страницы, а не из всех книг пользователя.

**Пример:**
- Всего книг: 25
- На странице: 10
- В процессе (реально): 15
- В процессе (показывается): 5 (только из 10 на странице)

### P2: Разные критерии завершения

| Источник | Критерий |
|----------|----------|
| Backend (reading-statistics) | `progress >= 95%` |
| Frontend (useLibraryFilters) | `progress === 100%` |

### P3: Разный staleTime кэша

- HomePage: 30 секунд
- LibraryPage: `refetchOnMount: 'always'`

---

## 3. Решение

### Использовать серверную статистику везде

**Изменение в LibraryPage.tsx:**

```typescript
// Добавить запрос серверной статистики
const { data: readingStats } = useQuery({
  queryKey: ['userReadingStatistics'],
  queryFn: () => booksAPI.getUserReadingStatistics(),
  staleTime: 30000,
});

// Использовать серверные данные
<LibraryStats
  totalBooks={data?.total || 0}
  booksInProgress={readingStats?.books_in_progress ?? 0}
  booksCompleted={readingStats?.books_completed ?? 0}
  processingBooks={stats.processingBooks}
/>
```

### Унифицировать критерий завершения

**Изменение в useLibraryFilters.ts:**

```typescript
const booksCompleted = books.filter(
  b => b.reading_progress_percent && b.reading_progress_percent >= 95
).length;
```

---

## 4. Оценка времени

| Задача | Время |
|--------|-------|
| Рефакторинг LibraryPage | 1 час |
| Унификация критериев | 30 мин |
| Тестирование | 30 мин |
| **Итого** | **~2 часа** |
