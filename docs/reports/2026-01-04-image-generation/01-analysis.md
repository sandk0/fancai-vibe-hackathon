# Анализ системы генерации изображений

**Дата:** 4 января 2026
**Статус:** Завершён
**Тип:** Комплексный анализ

---

## Резюме

Проведён полный анализ системы генерации изображений. **Главное открытие:** фоновая очередь Celery **уже реализована** на backend, но frontend её **не использует**, делая синхронные запросы с timeout 120 секунд.

---

## 1. Архитектура генерации

### 1.1 Backend: Два режима работы

| Режим | Эндпоинт | Описание |
|-------|----------|----------|
| **Синхронный** | `POST /images/generate/description/{id}` | Блокирующий запрос, ждёт результата |
| **Асинхронный** | `POST /images/generate/async/{id}` | Возвращает `task_id`, результат через polling |

### 1.2 Текущая схема работы

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│   useImageModal → imagesAPI.generateImageForDescription()       │
│        ↓                                                         │
│   Синхронно ждёт 120 секунд ← ← ← ПРОБЛЕМА!                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│   POST /images/generate/description/{id}                         │
│        ↓                                                         │
│   ImagenService.generate_image() ← tenacity retry (4 попытки)   │
│        ↓                                                         │
│   Google Imagen 4 API (нестабилен, ~50% отказов)                │
│        ↓                                                         │
│   Ответ клиенту (30-90 секунд)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Желаемая схема работы

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│   useImageModal → imagesAPI.generateAsync() → task_id           │
│        ↓                                                         │
│   Polling каждые 3 секунды: GET /images/task/{task_id}          │
│   Статус: "generating" → UI показывает прогресс                 │
│   Статус: "completed" → Показать изображение                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
│   POST /images/generate/async/{id}                               │
│        ↓                                                         │
│   Celery Task: generate_image_task.delay()                       │
│        ↓                                                         │
│   Redis Queue (persistent) ← Celery retry (3 попытки)           │
│        ↓                                                         │
│   Мгновенный ответ: {task_id, status: "queued"}                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Компоненты системы

### 2.1 Backend (8 файлов, ~4000 строк)

| Файл | Строк | Роль |
|------|-------|------|
| `services/imagen_generator.py` | 657 | Google Imagen 4 API клиент |
| `services/image_generator.py` | 455 | Оркестратор + Celery интеграция |
| `routers/images.py` | 1143 | API эндпоинты |
| `core/tasks.py` | 885 | Celery задачи |
| `core/celery_app.py` | 66 | Базовая конфигурация Celery |
| `core/celery_config.py` | 222 | Расширенная конфигурация |
| `core/retry.py` | 516 | tenacity retry-логика |
| `models/image.py` | 199 | SQLAlchemy модель |

### 2.2 Frontend (12 файлов, ~4000 строк)

| Файл | Строк | Роль |
|------|-------|------|
| `api/images.ts` | 326 | API клиент |
| `services/imageCache.ts` | 800 | IndexedDB кеш |
| `hooks/api/useImages.ts` | 593 | TanStack Query хуки |
| `hooks/epub/useImageModal.ts` | 329 | Состояние модала |
| `components/Images/ImageModal.tsx` | 336 | Модальное окно |
| `components/Images/ImageGallery.tsx` | 369 | Галерея |
| `utils/retryWithBackoff.ts` | 443 | Retry-логика |

### 2.3 Database (1 таблица, 24 колонки)

```sql
generated_images (
  id UUID PRIMARY KEY,
  description_id UUID REFERENCES descriptions(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id),  -- опционально
  user_id UUID REFERENCES users(id),
  service_used VARCHAR(50),  -- CHECK: pollinations/imagen/...
  status VARCHAR(20),        -- CHECK: pending/generating/completed/failed
  image_url VARCHAR(2000),
  prompt_used TEXT,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  ...
)
```

---

## 3. Celery очереди

### 3.1 Настроенные очереди

| Очередь | Приоритет | Rate Limit | Задачи |
|---------|-----------|------------|--------|
| `heavy` | 10 | 5/min | `process_book_task` |
| `normal` | 5 | 30/min | `generate_image_task`, `generate_image_batch_task` |
| `light` | 3 | - | `cleanup_old_images_task`, `close_abandoned_sessions` |

### 3.2 Retry конфигурация

| Уровень | Попытки | Задержки |
|---------|---------|----------|
| tenacity (ImagenService) | 4 | 2s → 4s → 8s → 16s (+jitter) |
| Celery (generate_image_task) | 3 | 30s → backoff до 300s |
| **Итого** | до 12! | ~5-10 минут |

---

## 4. Выявленные проблемы

### 4.1 Критические (P0)

| ID | Проблема | Влияние |
|----|----------|---------|
| **P0-1** | Frontend не использует async эндпоинты | 120s timeout, плохой UX |
| **P0-2** | Двойной retry (12 попыток) | Избыточные затраты на API |
| **P0-3** | Два разных celery_app | Непредсказуемое поведение |

### 4.2 Высокие (P1)

| ID | Проблема | Влияние |
|----|----------|---------|
| **P1-1** | AbortController не передаётся в API | Отмена не работает |
| **P1-2** | Нет rate limiting на API | Возможные злоупотребления |
| **P1-3** | Worker без указания очередей | Приоритеты не работают |

### 4.3 Средние (P2)

| ID | Проблема | Влияние |
|----|----------|---------|
| **P2-1** | Zustand store дублирует TanStack Query | Несинхронизированное состояние |
| **P2-2** | In-memory кеш переводов | Теряется при перезапуске |
| **P2-3** | Избыточные колонки в БД | Нарушение нормализации |

---

## 5. Статистика

### Файлы

| Категория | Файлов | Строк кода |
|-----------|--------|------------|
| Backend | 8 | ~4000 |
| Frontend | 12 | ~4000 |
| Database | 1 таблица | 24 колонки |
| **Итого** | 20 | ~8000 |

### Эндпоинты

| Категория | Количество |
|-----------|------------|
| Синхронная генерация | 2 |
| Асинхронная генерация | 2 |
| Получение данных | 6 |
| Модификация | 3 |
| **Итого** | 13 |

---

## Связанные документы

- [02-action-plan.md](./02-action-plan.md) - План доработок
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт о завершении Фазы 1
