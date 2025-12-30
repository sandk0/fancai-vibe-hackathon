# Аудит системы статистики пользователя

**Дата:** 29 декабря 2025
**Статус:** Критические проблемы ИСПРАВЛЕНЫ

## Краткое резюме

Проведён глубокий анализ системы статистики чтения. Выявлено **15 проблем** разной степени критичности.

### Критичность проблем

| Уровень | Количество | Статус |
|---------|------------|--------|
| P0 (критично) | 4 | ✅ ИСПРАВЛЕНО |
| P1 (важно) | 2 | ✅ ИСПРАВЛЕНО |
| P2 (желательно) | 9 | ✅ ИСПРАВЛЕНО |

---

## Исправленные проблемы

### P0-1: Некорректный расчёт прочитанных страниц ✅

**Файл:** `user_statistics_service.py:356-398`

**Было:** `total_pages * current_position / 100` — неверно для legacy записей

**Стало:** Используется CFI-aware метод `Book.get_reading_progress_percent()`

---

### P0-2: Некорректный расчёт прочитанных глав ✅

**Файл:** `user_statistics_service.py:400-420`

**Было:** `sum(current_chapter)` — считал текущую главу, а не прочитанные

**Стало:** `sum(GREATEST(current_chapter - 1, 0))`

---

### P0-3: longestStreak = currentStreak ✅

**Изменения:**
- Добавлено поле `longest_streak_days` в модель `User`
- Создана миграция `2025_12_29_0001_add_longest_streak.py`
- Добавлен метод `get_reading_streak_with_longest()`
- Обновлён API endpoint `/users/reading-statistics`
- Обновлён frontend `StatsPage.tsx`

---

### P0-4: Разные формулы среднего времени ✅

**Было:**
- StatsPage: `weekly_activity / 7`
- ProfilePage: `total_time / streak`

**Стало:** Единая формула на backend:
```python
avg_minutes_per_day = total_minutes / days_with_reading_activity
```

Добавлено поле `avg_minutes_per_day` в API response.

---

### P1-1: duration_minutes = NULL при update ✅

**Файл:** `reading_sessions.py`

Теперь `duration_minutes` обновляется при каждом update сессии, а не только при завершении.

---

### P1-2: Нет cleanup осиротевших сессий ✅

**Файл:** `reading_session_service.py`

Добавлен метод `cleanup_orphan_active_sessions()` для завершения активных сессий старше 24 часов.

---

## Файлы изменений

### Backend
| Файл | Изменения |
|------|-----------|
| `app/models/user.py` | +`longest_streak_days` поле |
| `app/services/user_statistics_service.py` | Исправлены методы расчёта |
| `app/services/reading_session_service.py` | +`cleanup_orphan_active_sessions()` |
| `app/routers/users.py` | +`longest_streak_days`, +`avg_minutes_per_day` |
| `app/routers/reading_sessions.py` | +update `duration_minutes` |
| `alembic/versions/2025_12_29_0001_*.py` | Новая миграция |

### Frontend
| Файл | Изменения |
|------|-----------|
| `src/types/api.ts` | +`longest_streak_days`, +`avg_minutes_per_day` |
| `src/pages/StatsPage.tsx` | Используется API data вместо локального расчёта |
| `src/pages/ProfilePage.tsx` | Используется API data |

---

## Отчёты

1. [Backend статистика](./02-backend-statistics.md)
2. [Frontend отображение](./03-frontend-display.md)
3. [Запись данных сессий](./04-reading-sessions.md)
4. [План исправлений](./05-fix-plan.md)

---

## Выполненные P2 улучшения (30 декабря 2025)

1. ✅ Добавлено кэширование статистики (Redis, TTL 5 мин)
2. ✅ Оптимизирован get_books_count_by_status (SQL COUNT + CASE)
3. ✅ Добавлены метрики "за этот месяц" (books, reading_time, pages)
4. ✅ Добавлено поле timezone в User model + миграция
5. ✅ Вынесен formatReadingTime в src/utils/formatters.ts
6. ✅ Исправлен eslint-disable в useReadingSession.ts (используется positionRef)

---

## Применение изменений

```bash
# 1. Применить миграцию
cd backend
alembic upgrade head

# 2. Перезапустить сервисы
docker-compose restart backend celery-worker
```
