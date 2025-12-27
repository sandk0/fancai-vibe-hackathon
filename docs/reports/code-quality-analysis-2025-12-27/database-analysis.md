# Database Анализ: PostgreSQL + SQLAlchemy

**Дата:** 27 декабря 2025
**Оценка:** 7.0/10

---

## Резюме

База данных PostgreSQL 15 с SQLAlchemy 2.0 async ORM. Схема хорошо спроектирована, но есть проблемы с lazy loading по умолчанию, дублированными индексами и неидемпотентными миграциями.

---

## Критические Проблемы

### P0-001: Default lazy loading

**Проблема:** Все relationship определены с `lazy="select"` (по умолчанию), что вызывает N+1 queries.

**Файлы:** Все модели в `app/models/`

**Пример проблемы:**
```python
class Book(Base):
    chapters = relationship("Chapter", back_populates="book")
    # lazy="select" по умолчанию — каждый доступ = отдельный запрос

# В сервисе
books = await session.execute(select(Book))
for book in books.scalars():
    print(len(book.chapters))  # N+1 query!
```

**Решение:**
```python
# 1. Явно указать lazy mode
chapters = relationship("Chapter", back_populates="book", lazy="raise")

# 2. В запросах использовать eager loading
from sqlalchemy.orm import selectinload
query = select(Book).options(selectinload(Book.chapters))
```

---

### P1-001: Дублированные индексы в миграциях

**Файл:** `alembic/versions/`

**Проблема:**
```python
# В нескольких миграциях
op.create_index('idx_reading_progress_user_book',
                'reading_progress', ['user_id', 'book_id'])
# Индекс создаётся повторно в другой миграции
```

**Решение:** Добавить проверку существования:
```python
if not op.get_bind().dialect.has_index(
    op.get_bind(), 'reading_progress', 'idx_reading_progress_user_book'):
    op.create_index('idx_reading_progress_user_book', ...)
```

---

### P1-002: Неидемпотентные миграции

**Проблема:** При повторном применении миграции падают с ошибкой.

**Решение:**
```python
# Добавить if not exists
op.execute("""
    CREATE INDEX IF NOT EXISTS idx_name
    ON table_name (column_name)
""")
```

---

### P2-001: Отсутствие CASCADE на FK

**Файлы:**
- `app/models/generated_image.py`
- `app/models/reading_session.py`

**Проблема:**
```python
book_id = Column(Integer, ForeignKey("books.id"))  # Нет ondelete
```

**Решение:**
```python
book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"))
```

---

## Проблемы Средней Важности

### P2-002: Отсутствие composite index

**Таблица:** `reading_progress`

**Проблема:** Частый запрос `WHERE user_id = ? AND book_id = ?` не имеет composite index.

**Решение:**
```python
# В модели
__table_args__ = (
    Index('idx_reading_progress_user_book', 'user_id', 'book_id'),
)
```

### P2-003: N+1 в cleanup операциях

**Файл:** `app/services/cleanup_service.py`

**Проблема:**
```python
# Удаление по одному
for old_image in old_images:
    await session.delete(old_image)
```

**Решение:**
```python
# Bulk delete
await session.execute(
    delete(GeneratedImage).where(GeneratedImage.id.in_(old_image_ids))
)
```

---

## Положительные Аспекты

1. **Async SQLAlchemy 2.0** — современный асинхронный ORM
2. **Alembic миграции** — версионирование схемы
3. **Connection pooling** — правильная настройка пула
4. **UUID primary keys** — для некоторых таблиц
5. **Proper indexes** — на часто используемых колонках

---

## Рекомендации по Рефакторингу

### Фаза 1: Критические (2-3 дня)

| Задача | Файлы | Часы |
|--------|-------|------|
| Добавить `lazy="raise"` ко всем relationship | models/*.py | 4 |
| Исправить N+1 в сервисах (selectinload) | services/*.py | 8 |
| Добавить composite index reading_progress | migrations/ | 2 |

### Фаза 2: Важные (3-5 дней)

| Задача | Файлы | Часы |
|--------|-------|------|
| Сделать миграции идемпотентными | alembic/versions/ | 8 |
| Добавить ondelete="CASCADE" | models/*.py + migration | 4 |
| Bulk delete в cleanup | cleanup_service.py | 4 |

---

## Файлы для Изменения

| Приоритет | Файл | Изменение |
|-----------|------|-----------|
| P0 | `app/models/*.py` | lazy="raise" |
| P1 | `app/services/*.py` | selectinload/joinedload |
| P1 | Новая миграция | composite index |
| P2 | `app/models/*.py` | ondelete="CASCADE" |

---

## SQL для Проверки N+1

```sql
-- Включить логирование запросов
SET log_statement = 'all';

-- Проверить отсутствующие индексы
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY n_distinct DESC;
```

---

*Анализ выполнен агентом Database Architect (Claude Opus 4.5)*
