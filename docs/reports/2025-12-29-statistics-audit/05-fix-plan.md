# План исправления статистики

**Дата:** 29 декабря 2025
**Обновлено:** 30 декабря 2025
**Приоритизация:** P0 (критично) → P1 (важно) → P2 (желательно)

## Сводка проблем

| Приоритет | Проблем | Статус |
|-----------|---------|--------|
| P0 | 4 | ✅ ИСПРАВЛЕНО |
| P1 | 2 | ✅ ИСПРАВЛЕНО |
| P2 | 9 | ✅ ИСПРАВЛЕНО |

---

## P0: Критические исправления ✅ ВЫПОЛНЕНО

### P0-1: Исправить расчёт прочитанных страниц ✅

**Файл:** `backend/app/services/user_statistics_service.py:356-386`

**Задача:** Использовать CFI-aware метод `Book.get_reading_progress_percent()` вместо формулы `total_pages * current_position / 100`.

**Изменения:**

```python
@staticmethod
async def get_total_pages_read(db: AsyncSession, user_id: UUID) -> int:
    """
    Корректный расчёт прочитанных страниц.
    Использует CFI-aware метод для точного прогресса.
    """
    from sqlalchemy.orm import selectinload

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
        if not book.total_pages:
            continue
        progress_percent = await book.get_reading_progress_percent(db, user_id)
        total_pages += int(book.total_pages * progress_percent / 100)

    return total_pages
```

**Тест:**
```python
# Книга с 10 главами, 500 страниц
# Пользователь на главе 3, позиция 50% в главе
# Ожидаемый результат: ~150 страниц (30% книги)
# НЕ 250 страниц (50% от 500)
```

---

### P0-2: Исправить расчёт прочитанных глав ✅

**Файл:** `backend/app/services/user_statistics_service.py:388-409`

**Задача:** Считать `current_chapter - 1` вместо `current_chapter`.

**Изменения:**

```python
@staticmethod
async def get_total_chapters_read(db: AsyncSession, user_id: UUID) -> int:
    """
    Возвращает количество ПРОЧИТАННЫХ глав.
    current_chapter - это глава, которую читает (не дочитал).
    Прочитанные = current_chapter - 1.
    """
    query = select(
        func.sum(
            func.greatest(ReadingProgress.current_chapter - 1, 0)
        )
    ).where(ReadingProgress.user_id == user_id)

    result = await db.execute(query)
    total = result.scalar()
    return int(total or 0)
```

---

### P0-3: Добавить longest_streak в модель User ✅

**Файлы:**
- `backend/app/models/user.py`
- `backend/app/services/user_statistics_service.py`
- `backend/alembic/versions/` (новая миграция)

**Миграция:**

```python
# alembic/versions/2025_12_29_0001_add_longest_streak.py
def upgrade():
    op.add_column('users', sa.Column('longest_streak_days', sa.Integer(), default=0))

def downgrade():
    op.drop_column('users', 'longest_streak_days')
```

**Сервис:**

```python
@staticmethod
async def get_reading_streak_with_longest(
    db: AsyncSession, user_id: UUID
) -> Dict[str, int]:
    """Возвращает текущий и лучший streak."""
    current = await UserStatisticsService.get_reading_streak(db, user_id)

    user = await db.get(User, user_id)
    longest = user.longest_streak_days if user else 0

    # Обновляем longest если текущий больше
    if current > longest and user:
        user.longest_streak_days = current
        await db.commit()
        longest = current

    return {"current": current, "longest": longest}
```

---

### P0-4: Унифицировать формулу среднего времени ✅

**Файлы:**
- `backend/app/services/user_statistics_service.py` (добавить метод)
- `backend/app/routers/users.py` (добавить в response)
- `frontend/src/pages/StatsPage.tsx` (убрать локальный расчёт)
- `frontend/src/pages/ProfilePage.tsx` (убрать локальный расчёт)

**Backend:**

```python
@staticmethod
async def get_average_reading_time_per_day(
    db: AsyncSession, user_id: UUID
) -> int:
    """
    Среднее время чтения в минутах за день.
    Формула: total_minutes / days_with_activity
    """
    # Получаем дни с активностью
    days_query = (
        select(func.count(func.distinct(func.date(ReadingSession.started_at))))
        .where(ReadingSession.user_id == user_id)
        .where(ReadingSession.is_active == False)
        .where(ReadingSession.duration_minutes >= 1)
    )
    days_result = await db.execute(days_query)
    days_count = days_result.scalar() or 1

    # Общее время
    total_minutes = await UserStatisticsService.get_total_reading_time(db, user_id)

    return total_minutes // max(1, days_count)
```

**Frontend:**

```typescript
// Удалить локальные расчёты, использовать данные из API
averagePerDay: s.avg_minutes_per_day || 0,
```

---

## P1: Важные исправления ✅ ВЫПОЛНЕНО

### P1-1: Обновлять duration_minutes при каждом update ✅

**Файл:** `backend/app/routers/reading_sessions.py` (update endpoint)

```python
@router.put("/{session_id}")
async def update_session(session_id: UUID, position: float, db: AsyncSession):
    session = await get_session(session_id)
    session.end_position = position
    session.duration_minutes = int(
        (datetime.now(timezone.utc) - session.started_at).total_seconds() / 60
    )
    await db.commit()
    return session
```

---

### P1-2: Добавить cleanup "осиротевших" сессий ✅

**Файл:** `backend/app/services/reading_session_service.py`

```python
@staticmethod
async def cleanup_orphan_sessions(db: AsyncSession, hours_threshold: int = 24) -> int:
    """
    Завершает активные сессии старше N часов.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_threshold)

    query = select(ReadingSession).where(
        ReadingSession.is_active == True,
        ReadingSession.started_at < cutoff,
    )

    result = await db.execute(query)
    orphan_sessions = result.scalars().all()

    for session in orphan_sessions:
        session.is_active = False
        session.ended_at = session.updated_at or datetime.now(timezone.utc)
        session.duration_minutes = int(
            (session.ended_at - session.started_at).total_seconds() / 60
        )

    await db.commit()
    return len(orphan_sessions)
```

**Celery task:**

```python
@celery_app.task
def cleanup_orphan_sessions_task():
    asyncio.run(reading_session_service.cleanup_orphan_sessions(db, hours=24))
```

---

### P1-3: Добавить метрики "за этот месяц"

**Backend response:**

```python
# Добавить в /api/v1/users/reading-statistics
{
    "total_books": 15,
    "total_reading_time_minutes": 1200,
    "reading_streak_days": 10,
    "longest_streak_days": 25,  # NEW
    "avg_minutes_per_day": 40,  # NEW
    "books_this_month": 2,      # NEW
    "reading_time_this_month": 480,  # NEW
    "pages_this_month": 320,    # NEW
}
```

---

### P1-4: Исправить потерю точности при округлении

**Frontend:**

```typescript
// Было:
totalHours: Math.round((s.total_reading_time_minutes || 0) / 60),

// Стало (показывать с минутами):
const formatReadingTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} мин`;
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
};
```

---

### P1-5: Убрать fallback chapters*20

**Frontend:**

```typescript
// Было:
totalPages: s.total_pages_read || (s.total_chapters_read * 20) || 0,

// Стало:
totalPages: s.total_pages_read || 0,
// Если 0 — показывать "—" вместо числа
```

---

## P2: Желательные улучшения ✅ ВЫПОЛНЕНО

### P2-1: Добавить кэширование статистики ✅

```python
# Redis cache с TTL 5 минут
cache_key = f"user_stats:{user_id}"
cached = await cache_manager.get(cache_key)
if cached:
    return json.loads(cached)

stats = await compute_stats(db, user_id)
await cache_manager.set(cache_key, json.dumps(stats), ttl=300)
return stats
```

---

### P2-2: Оптимизировать get_books_count_by_status ✅

Использует SQL COUNT с CASE вместо загрузки всех книг в память.
Оптимизация выполняется на стороне БД с поддержкой CFI и legacy режимов.

---

### P2-3: Добавить метрики "за этот месяц" ✅

Добавлены:
- `books_this_month` - книги с активностью в этом месяце
- `reading_time_this_month` - минуты чтения за месяц
- `pages_this_month` - страницы за месяц

Backend: `get_monthly_statistics()` метод
Frontend: StatsPage.tsx использует данные из API

---

### P2-4: Удалить eslint-disable в useReadingSession.ts ✅

Исправлены зависимости useEffect с использованием positionRef.
Убран eslint-disable директива.

---

### P2-5: Исправить interval зависимости ✅

```typescript
// Убрать currentPosition из зависимостей
}, [enabled, updateInterval]);

// Использовать ref для currentPosition
const positionRef = useRef(currentPosition);
useEffect(() => {
  positionRef.current = currentPosition;
}, [currentPosition]);
```

---

### P2-6: Вынести formatMinutes в utils ✅

Создан `src/utils/formatters.ts` с функцией `formatReadingTime()`.
StatsPage.tsx использует импорт вместо локальной функции.

```typescript
// src/utils/formatters.ts
export const formatReadingTime = (minutes: number): string => {
  if (minutes === 0) return '0 мин';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} мин`;
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
};
```

---

### P2-7: Добавить timezone пользователя ✅

Добавлено поле `timezone` в User model (IANA timezone name, default "UTC").
Создана миграция `2025_12_30_0001_add_user_timezone.py`.

---

## Порядок выполнения

```
Week 1 (P0):
├── P0-1: Расчёт страниц
├── P0-2: Расчёт глав
├── P0-3: longest_streak
└── P0-4: avg_minutes_per_day

Week 2 (P1):
├── P1-1: duration_minutes update
├── P1-2: cleanup orphan sessions
├── P1-3: метрики за месяц
├── P1-4: точность округления
└── P1-5: убрать fallback

Week 3 (P2):
├── P2-1: кэширование
├── P2-2: оптимизация запросов
├── P2-3: eslint-disable
├── P2-4: interval fix
├── P2-5: formatters util
└── P2-6: timezone
```

---

## Тестирование

### Unit тесты

```python
# tests/test_user_statistics.py
async def test_total_pages_read_with_cfi():
    """Проверка расчёта страниц с CFI прогрессом."""
    ...

async def test_total_chapters_read():
    """current_chapter=5 → прочитано 4 главы."""
    ...

async def test_longest_streak_persists():
    """longest_streak сохраняется при сбросе current."""
    ...
```

### E2E тесты

1. Создать книгу с 10 главами, 500 страниц
2. Прочитать до главы 3
3. Проверить: страницы ≈ 150, главы = 2
4. Прервать серию
5. Проверить: longest_streak > current_streak

---

## Метрики успеха

| Метрика | До | После |
|---------|-----|-------|
| Расхождение страниц | До 5x | < 5% |
| Расхождение глав | +1 на книгу | 0 |
| longestStreak = currentStreak | 100% | 0% |
| Разные формулы avg time | 2 формулы | 1 формула |
| Незавершённые сессии | ∞ | 0 (cleanup) |
