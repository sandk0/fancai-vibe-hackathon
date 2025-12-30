# Backend: Анализ расчёта статистики

**Файл:** `backend/app/services/user_statistics_service.py`
**Строк:** 410

## Критические проблемы

### 1. Некорректный расчёт прочитанных страниц (HIGH)

**Расположение:** `user_statistics_service.py:374-386`

```python
# ТЕКУЩИЙ КОД (НЕВЕРНЫЙ)
query = (
    select(
        func.sum(Book.total_pages * ReadingProgress.current_position / 100.0)
    )
    .select_from(ReadingProgress)
    .join(Book, ReadingProgress.book_id == Book.id)
    .where(ReadingProgress.user_id == user_id)
)
```

**Проблема:**

Формула `total_pages * current_position / 100` предполагает, что `current_position` — это процент прогресса по ВСЕЙ книге (0-100%).

Однако для **legacy записей** (без CFI) поле `current_position` содержит **процент в ТЕКУЩЕЙ ГЛАВЕ**, а не по книге!

| Тип записи | `current_position` | Что означает |
|------------|-------------------|--------------|
| CFI (EPUB) | 0-100% | % от начала книги |
| Legacy | 0-100% | % в текущей главе |

**Пример ошибки:**

- Книга: 10 глав, 500 страниц
- Пользователь: на 3 главе, позиция 50%
- **Ожидаемый результат:** ~150 страниц (3 главы × 50 страниц)
- **Текущий результат:** 250 страниц (500 × 50 / 100)

**Исправление:**

```python
@staticmethod
async def get_total_pages_read(db: AsyncSession, user_id: UUID) -> int:
    """
    Корректный расчёт прочитанных страниц с учётом CFI и legacy форматов.
    """
    from sqlalchemy.orm import selectinload

    # Загружаем книги с прогрессом для корректного расчёта
    books_query = (
        select(Book)
        .options(selectinload(Book.reading_progress))
        .options(selectinload(Book.chapters))
        .where(Book.user_id == user_id)
    )
    result = await db.execute(books_query)
    books = result.scalars().all()

    total_pages = 0
    for book in books:
        if not book.total_pages or book.total_pages == 0:
            continue

        # Используем CFI-aware метод для получения реального прогресса
        progress_percent = await book.get_reading_progress_percent(db, user_id)
        pages_read = int(book.total_pages * progress_percent / 100)
        total_pages += pages_read

    return total_pages
```

---

### 2. Некорректный расчёт прочитанных глав (HIGH)

**Расположение:** `user_statistics_service.py:402-409`

```python
# ТЕКУЩИЙ КОД (НЕВЕРНЫЙ)
query = select(func.sum(ReadingProgress.current_chapter)).where(
    ReadingProgress.user_id == user_id
)
```

**Проблема:**

`sum(current_chapter)` суммирует **ТЕКУЩУЮ** главу, а не **ПРОЧИТАННЫЕ**.

Если пользователь читает главу 5 — он прочитал 4 главы, а не 5!

**Пример:**

| Книга | current_chapter | Прочитано глав | Текущий результат |
|-------|----------------|----------------|-------------------|
| Книга 1 | 5 | 4 | 5 |
| Книга 2 | 10 | 9 | 10 |
| **Итого** | — | **13** | **15** (НЕВЕРНО) |

**Исправление:**

```python
@staticmethod
async def get_total_chapters_read(db: AsyncSession, user_id: UUID) -> int:
    """
    Возвращает общее количество ПРОЧИТАННЫХ глав.
    current_chapter - это глава, которую читает пользователь (1-indexed).
    Прочитанные главы = current_chapter - 1.
    """
    # Вариант 1: SQL с корректировкой
    query = select(
        func.sum(
            func.greatest(ReadingProgress.current_chapter - 1, 0)
        )
    ).where(ReadingProgress.user_id == user_id)

    result = await db.execute(query)
    total_chapters = result.scalar()

    return int(total_chapters or 0)
```

---

### 3. Отсутствует отслеживание longest_streak (MEDIUM)

**Расположение:** `user_statistics_service.py:139-207`

**Проблема:**

Метод `get_reading_streak()` возвращает только текущий streak. Backend не отслеживает **лучший результат** (`longest_streak`).

**Текущее поведение:**

- Frontend получает `reading_streak_days = 5`
- Frontend показывает: Текущая серия = 5, Лучшая серия = 5 (тоже 5!)

**Решение:**

Добавить поле `longest_streak_days` в модель User или отдельную таблицу статистики:

```python
# models/user.py
class User(Base):
    # ... existing fields ...
    longest_streak_days: Mapped[int] = mapped_column(default=0)

# services/user_statistics_service.py
@staticmethod
async def get_reading_streak_with_longest(
    db: AsyncSession, user_id: UUID
) -> Dict[str, int]:
    """Возвращает текущий и лучший streak."""
    current_streak = await UserStatisticsService.get_reading_streak(db, user_id)

    # Получаем сохранённый longest streak
    user = await db.get(User, user_id)
    longest_streak = user.longest_streak_days if user else 0

    # Обновляем longest если текущий больше
    if current_streak > longest_streak:
        user.longest_streak_days = current_streak
        await db.commit()
        longest_streak = current_streak

    return {
        "current": current_streak,
        "longest": longest_streak
    }
```

---

## Проблемы средней критичности

### 4. Timezone awareness при агрегации по датам (MEDIUM)

**Расположение:** `user_statistics_service.py:84, 94, 170, 174`

```python
# Проблема: cast(ReadingSession.started_at, Date) не учитывает timezone
cast(ReadingSession.started_at, Date).label("reading_date")
```

**Проблема:**

PostgreSQL `DATE` cast использует timezone сервера, а не пользователя. Сессия в 23:59 UTC может попасть в "завтра" для пользователя в UTC+3.

**Решение:**

```python
from sqlalchemy import text

# Использовать timezone-aware cast
# Или хранить timezone пользователя и конвертировать
func.date(
    func.timezone('UTC', ReadingSession.started_at)
).label("reading_date")
```

---

### 5. Отсутствуют метрики "за этот месяц" (MEDIUM)

**Текущее состояние:**

Frontend показывает "в этом месяце", но backend не предоставляет эти данные:

```python
# StatsPage.tsx:78
booksThisMonth: 0,  # TODO: need backend field
pagesThisMonth: 0,  # TODO: need backend field
```

**Решение:**

Добавить метод в `UserStatisticsService`:

```python
@staticmethod
async def get_monthly_stats(db: AsyncSession, user_id: UUID) -> Dict:
    """Статистика за текущий месяц."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Время чтения за месяц
    time_query = select(func.sum(ReadingSession.duration_minutes)).where(
        ReadingSession.user_id == user_id,
        ReadingSession.started_at >= month_start,
        ReadingSession.is_active == False,
    )

    # Книги, начатые в этом месяце
    books_query = select(func.count(Book.id)).where(
        Book.user_id == user_id,
        Book.created_at >= month_start,
    )

    # ... execute queries ...

    return {
        "reading_time_minutes": time_minutes,
        "books_started": books_count,
        "sessions_count": sessions_count,
    }
```

---

### 6. Потенциальный race condition при обновлении longest_streak (MEDIUM)

Если пользователь открывает приложение с нескольких устройств одновременно, возможно дублирование обновления streak.

**Решение:** Использовать `SELECT FOR UPDATE` или optimistic locking.

---

## Проблемы низкой критичности

### 7. Отсутствует кэширование статистики (LOW)

Каждый запрос `/api/v1/users/reading-statistics` выполняет 5+ SQL запросов.

**Решение:** Добавить Redis кэш с TTL 5 минут:

```python
cache_key = f"user_stats:{user_id}"
cached = await cache_manager.get(cache_key)
if cached:
    return json.loads(cached)

# ... compute stats ...

await cache_manager.set(cache_key, json.dumps(stats), ttl=300)
```

---

### 8. Неоптимальные запросы для get_books_count_by_status (LOW)

**Расположение:** `user_statistics_service.py:258-321`

Метод загружает ВСЕ книги пользователя в память для подсчёта статусов.

**Текущий подход:**
```python
books_result = await db.execute(books_query)
books_with_progress = books_result.scalars().unique().all()

for book in books_with_progress:
    progress_percent = await book.get_reading_progress_percent(db, user_id)
    # ...
```

**Проблема:** При 100+ книгах это создаёт нагрузку на память и N+1 запросы.

---

## Сводная таблица

| # | Проблема | Критичность | Строки | Статус |
|---|----------|-------------|--------|--------|
| 1 | Некорректный расчёт страниц | HIGH | 374-386 | Требует исправления |
| 2 | Некорректный расчёт глав | HIGH | 402-409 | Требует исправления |
| 3 | Нет longest_streak | MEDIUM | 139-207 | Требует доработки |
| 4 | Timezone при агрегации | MEDIUM | 84, 94, 170 | Рекомендуется |
| 5 | Нет метрик "за месяц" | MEDIUM | — | Требует добавления |
| 6 | Race condition streak | MEDIUM | — | Рекомендуется |
| 7 | Нет кэширования | LOW | — | Оптимизация |
| 8 | Неоптимальные запросы | LOW | 258-321 | Оптимизация |
