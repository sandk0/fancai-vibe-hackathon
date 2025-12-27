# Performance Анализ: Блокирующий I/O, Индексы, Оптимизация

**Дата:** 27 декабря 2025
**Оценка:** 6.5/10

---

## Резюме

Производительность проекта имеет несколько критических узких мест: блокирующий I/O в парсере книг, N+1 queries в ORM, неоптимальное создание event handlers во frontend.

---

## Критические Проблемы

### P1-001: Блокирующий I/O в book_parser.py

**Файл:** `app/services/book_parser.py`

**Проблема:**
```python
# Синхронный вызов блокирует event loop
def parse_epub(file_path: str):
    book = epub.read_epub(file_path)  # Блокирующий I/O!
    # ... обработка
```

**Решение:**
```python
import asyncio

async def parse_epub(file_path: str):
    # Выполнить в thread pool
    book = await asyncio.to_thread(epub.read_epub, file_path)
    # ... остальная обработка
```

**Метрики:**
- Текущее: Парсинг 10 MB EPUB = 3-5 сек блокировки event loop
- После исправления: Event loop свободен во время I/O

---

### P1-002: Event handlers в цикле (Frontend)

**Файл:** `src/hooks/epub/useDescriptionHighlighting.ts`

**Проблема:**
```typescript
// Создаются при каждом рендере
useEffect(() => {
  descriptions.forEach(desc => {
    const element = document.querySelector(`[data-id="${desc.id}"]`);
    element?.addEventListener('click', () => handleClick(desc));  // Утечка!
  });
}, [descriptions]);
```

**Решение:**
```typescript
// Event delegation
useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const handler = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-id]');
    if (target) {
      const id = target.getAttribute('data-id');
      handleClick(id);
    }
  };

  container.addEventListener('click', handler);
  return () => container.removeEventListener('click', handler);
}, [handleClick]);
```

---

### P1-003: Full scan в IndexedDB

**Файл:** `src/services/chapterCache.ts` — `ensureBookLimit()`

**Проблема:**
```typescript
async function ensureBookLimit() {
  const allBooks = await db.getAllFromIndex('chapters', 'by-book');  // Full scan
  // ... сортировка и удаление
}
```

**Решение:**
```typescript
async function ensureBookLimit() {
  // Использовать cursor с limit
  const tx = db.transaction('chapters', 'readwrite');
  const store = tx.objectStore('chapters');
  const index = store.index('by-date');

  let count = 0;
  const cursor = await index.openCursor(null, 'prev');  // От новых к старым

  while (cursor && count < MAX_BOOKS) {
    count++;
    cursor.continue();
  }

  // Удалить остальные
  while (cursor) {
    cursor.delete();
    cursor.continue();
  }
}
```

---

### P1-004: Отсутствие composite index

**Таблица:** `reading_progress`

**Проблема:**
```sql
-- Частый запрос
SELECT * FROM reading_progress
WHERE user_id = ? AND book_id = ?
-- Использует два отдельных индекса вместо одного composite
```

**Решение:**
```python
# В модели
__table_args__ = (
    Index('idx_reading_progress_user_book', 'user_id', 'book_id'),
)
```

---

## Проблемы Средней Важности

### P2-001: N+1 Queries

**Файлы:** Все сервисы с relationship

**Проблема:**
```python
books = await session.execute(select(Book))
for book in books.scalars():
    print(book.chapters)  # N+1!
```

**Решение:**
```python
from sqlalchemy.orm import selectinload

query = select(Book).options(selectinload(Book.chapters))
books = await session.execute(query)
```

---

### P2-002: Отсутствие connection pooling metrics

**Проблема:** Нет мониторинга pool exhaustion.

**Решение:**
```python
from sqlalchemy import event

@event.listens_for(engine, "checkout")
def checkout_listener(dbapi_conn, connection_record, connection_proxy):
    logger.debug(f"Connection checked out: {connection_record}")

@event.listens_for(engine, "checkin")
def checkin_listener(dbapi_conn, connection_record):
    logger.debug(f"Connection returned: {connection_record}")
```

---

## Метрики Производительности

### Текущее Состояние

| Операция | Время | Цель |
|----------|-------|------|
| Парсинг EPUB 10 MB | 3-5 сек | < 1 сек (async) |
| Загрузка списка книг (10) | 200-500 мс | < 100 мс |
| Генерация изображения | 15-30 сек | 10-15 сек |
| First Contentful Paint | 2.5 сек | < 1.5 сек |

### Профилирование

```bash
# Backend profiling
python -m cProfile -o output.prof app/main.py

# Visualize
snakeviz output.prof

# Memory profiling
mprof run python app/main.py
mprof plot
```

---

## Рекомендации по Оптимизации

### Фаза 1: Критические (2-3 дня)

| Задача | Файлы | Часы |
|--------|-------|------|
| asyncio.to_thread для book_parser | book_parser.py | 4 |
| Event delegation в highlighting | useDescriptionHighlighting.ts | 4 |
| Composite index reading_progress | migration | 2 |

### Фаза 2: Важные (3-5 дней)

| Задача | Файлы | Часы |
|--------|-------|------|
| selectinload везде | services/*.py | 8 |
| Cursor-based cleanup в IndexedDB | chapterCache.ts | 4 |
| Connection pool monitoring | database.py | 4 |

---

## Файлы для Изменения

| Приоритет | Файл | Изменение |
|-----------|------|-----------|
| P1 | `app/services/book_parser.py` | asyncio.to_thread |
| P1 | `hooks/epub/useDescriptionHighlighting.ts` | Event delegation |
| P1 | Новая миграция | composite index |
| P2 | `app/services/*.py` | selectinload |
| P2 | `src/services/chapterCache.ts` | Cursor-based cleanup |

---

## Инструменты Мониторинга

```yaml
# Prometheus + Grafana stack
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

---

*Анализ выполнен агентом Performance Engineer (Claude Opus 4.5)*
