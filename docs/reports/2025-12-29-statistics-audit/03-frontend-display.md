# Frontend: Анализ отображения статистики

**Файлы:**
- `frontend/src/pages/StatsPage.tsx` (552 строки)
- `frontend/src/pages/ProfilePage.tsx` (422 строки)

## Критические проблемы

### 1. Разные формулы среднего времени на разных страницах (HIGH)

**StatsPage.tsx:66-69:**
```typescript
// Формула: сумма минут за неделю / 7
const avgMinutesPerDay = s.weekly_activity && s.weekly_activity.length > 0
  ? Math.round(s.weekly_activity.reduce((sum, day) => sum + day.minutes, 0) / 7)
  : 0;
```

**ProfilePage.tsx:108:**
```typescript
// Формула: общее время / streak days
const avgMinutesPerDay = Math.round(
  (s.total_reading_time_minutes || 0) / Math.max(1, s.reading_streak_days || 1)
);
```

**Результат:**

| Данные | StatsPage | ProfilePage |
|--------|-----------|-------------|
| weekly_activity = [30,60,0,0,45,0,50] мин | 26 мин/день | — |
| total_reading_time = 1200 мин | — | — |
| reading_streak_days = 10 | — | 120 мин/день |

Пользователь видит **совершенно разные числа** на разных страницах!

**Решение:**

1. Определить единственную формулу для "среднего времени в день"
2. Рассчитывать на backend и возвращать одно значение

```typescript
// Рекомендуемая формула (на backend):
// avg_minutes_per_day = total_reading_time_minutes / days_since_registration
// или
// avg_minutes_per_day = total_reading_time_minutes / total_days_with_activity
```

---

### 2. longestStreak = currentStreak (HIGH)

**StatsPage.tsx:84:**
```typescript
longestStreak: s.reading_streak_days || 0, // TODO: track separately in backend
```

**Проблема:**

"Лучшая серия" всегда равна "Текущей серии". Это бессмысленно для пользователя.

**UI показывает:**

| Текущая серия | Лучшая серия | Логично? |
|---------------|--------------|----------|
| 5 дней | 5 дней | НЕТ |
| 0 дней (прервана) | 0 дней | НЕТ! |

Если пользователь прервал серию в 30 дней, он видит "Лучшая серия: 0".

**Решение:**

Backend должен хранить и возвращать `longest_streak_days` отдельно.

---

### 3. Потеря точности при округлении часов (MEDIUM)

**StatsPage.tsx:79:**
```typescript
totalHours: Math.round((s.total_reading_time_minutes || 0) / 60),
```

**Проблема:**

| Минуты | Math.round | Потеря |
|--------|------------|--------|
| 89 | 1 час | 29 минут |
| 119 | 2 часа | 1 минута |
| 30 | 1 час | Преувеличение на 30 мин |

**Решение:**

Использовать форматирование с минутами или Math.floor:

```typescript
// Вариант 1: показывать с минутами
const formatReadingTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} мин`;
  if (mins === 0) return `${hours}ч`;
  return `${hours}ч ${mins}м`;
};

// Вариант 2: использовать floor вместо round
totalHours: Math.floor((s.total_reading_time_minutes || 0) / 60),
```

---

## Проблемы средней критичности

### 4. Fallback для totalPages через умножение глав (MEDIUM)

**StatsPage.tsx:81:**
```typescript
totalPages: s.total_pages_read || (s.total_chapters_read * 20) || 0,
```

**Проблема:**

Если `total_pages_read` = 0 или null, используется `chapters * 20`. Это произвольное число, не связанное с реальными данными.

**Решение:**

Либо показывать "—" когда данных нет, либо рассчитывать на backend корректно.

---

### 5. Деление weekly_activity на фиксированное 7 (MEDIUM)

**StatsPage.tsx:67-68:**
```typescript
s.weekly_activity.reduce((sum, day) => sum + day.minutes, 0) / 7
```

**Проблема:**

Даже если `weekly_activity` содержит 3 дня (для нового пользователя), делим на 7.

**Пример:**
- Пользователь зарегистрировался 2 дня назад
- weekly_activity = [{minutes: 60}, {minutes: 30}]
- Реальное среднее = 45 мин/день
- Текущий результат = 90/7 = 13 мин/день (НЕВЕРНО!)

---

### 6. hoursThisMonth считается из weekly_activity (MEDIUM)

**StatsPage.tsx:72-74:**
```typescript
const hoursThisMonth = s.weekly_activity && s.weekly_activity.length > 0
  ? Math.round(s.weekly_activity.reduce((sum, day) => sum + day.minutes, 0) / 60)
  : 0;
```

**Проблема:**

`hoursThisMonth` показывает часы **за неделю**, а не за месяц!

Название поля не соответствует данным.

---

### 7. Отсутствует обработка пустых данных в некоторых местах (MEDIUM)

**StatsPage.tsx:121-122:**
```typescript
hours: Math.round(book.estimated_reading_time_hours * (book.reading_progress_percent / 100)),
```

Если `estimated_reading_time_hours` = null/undefined, результат будет NaN.

---

## Проблемы низкой критичности

### 8. Дублирование кода formatMinutes (LOW)

Функция `formatMinutes` определена в StatsPage, но может понадобиться в других местах.

**Решение:** Вынести в `src/utils/formatters.ts`.

---

### 9. Hardcoded тексты без i18n (LOW)

Все тексты на русском языке захардкожены в компонентах.

---

### 10. console.log в ProfilePage (LOW)

**ProfilePage.tsx:171:**
```typescript
onClick={() => console.log('Upload avatar')}
```

---

## Визуальные проблемы

### 11. booksThisMonth всегда 0

**StatsPage.tsx:238-240:**
```tsx
<span className="text-sm font-medium text-green-600">
  +{stats.booksThisMonth} в этом месяце
</span>
```

Показывает "+0 в этом месяце", что выглядит странно.

---

### 12. pagesThisMonth всегда 0

**StatsPage.tsx:291-293:**
```tsx
<span className="text-sm font-medium text-green-600">
  +{stats.pagesThisMonth} в этом месяце
</span>
```

---

## Сводная таблица

| # | Проблема | Критичность | Файл:строка | UI элемент |
|---|----------|-------------|-------------|------------|
| 1 | Разные формулы avg time | HIGH | StatsPage:66, ProfilePage:108 | "В среднем X мин в день" |
| 2 | longestStreak = currentStreak | HIGH | StatsPage:84 | "Лучшая серия" |
| 3 | Потеря точности часов | MEDIUM | StatsPage:79 | "X часов чтения" |
| 4 | Fallback chapters*20 | MEDIUM | StatsPage:81 | "X страниц прочитано" |
| 5 | Деление на 7 фиксированно | MEDIUM | StatsPage:67 | "В среднем X мин в день" |
| 6 | hoursThisMonth != месяц | MEDIUM | StatsPage:72-74 | "+Xч в этом месяце" |
| 7 | NaN при null values | MEDIUM | StatsPage:121 | Топ книг |
| 8 | Дублирование formatMinutes | LOW | StatsPage:146 | — |
| 9 | Нет i18n | LOW | Все | — |
| 10 | console.log в коде | LOW | ProfilePage:171 | — |
| 11 | booksThisMonth = 0 | LOW | StatsPage:238 | "+0 в этом месяце" |
| 12 | pagesThisMonth = 0 | LOW | StatsPage:291 | "+0 в этом месяце" |

---

## Диаграмма потока данных

```
Backend API Response:
{
  total_books: 5,
  total_reading_time_minutes: 1200,
  reading_streak_days: 10,
  weekly_activity: [{day: "Пн", minutes: 30}, ...],
  total_pages_read: 0,        // <-- Часто 0!
  total_chapters_read: 15
}
         │
         ▼
┌─────────────────────────────────────┐
│        StatsPage.tsx                │
├─────────────────────────────────────┤
│ totalHours = round(1200/60) = 20    │ OK
│ avgPerDay = sum(weekly)/7 = 26      │ ПРОБЛЕМА: делит на 7
│ longestStreak = 10                  │ ПРОБЛЕМА: = currentStreak
│ totalPages = 0 || 15*20 = 300       │ ПРОБЛЕМА: fallback
│ booksThisMonth = 0                  │ ПРОБЛЕМА: нет данных
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│        ProfilePage.tsx              │
├─────────────────────────────────────┤
│ avgPerDay = 1200/10 = 120           │ ДРУГАЯ ФОРМУЛА!
│ totalHours = round(1200/60) = 20    │ OK
└─────────────────────────────────────┘
```

---

## Рекомендации

1. **Унифицировать формулы** — все расчёты должны быть на backend
2. **Добавить поля в API response:**
   - `longest_streak_days`
   - `avg_minutes_per_day`
   - `books_this_month`
   - `pages_this_month`
   - `reading_time_this_month`
3. **Убрать fallback логику** — если данных нет, показывать "—" или скрывать блок
4. **Использовать единый утилитный модуль** для форматирования времени
