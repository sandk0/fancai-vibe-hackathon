# Book Parsing Workflow - Executive Summary

**Дата:** 2025-12-25
**Версия:** 1.0
**Автор:** Backend API Developer Agent

---

## TL;DR

Обнаружена **КРИТИЧЕСКАЯ** race condition в workflow обработки книги после загрузки. Глава 1 может быть неправильно помечена как служебная страница и никогда не получить описаний.

**Временное окно уязвимости:** 10-30 секунд после загрузки книги.

**Рекомендация:** Внедрить distributed lock для `is_service_page` (P0 FIX) СРОЧНО.

---

## Workflow Overview

### 3 Фазы Обработки Книги

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: UPLOAD (Синхронная, ~2-3s)                            │
├─────────────────────────────────────────────────────────────────┤
│ POST /api/v1/books/upload                                       │
│   → book_parser.parse_book() (TOC → chapters)                   │
│   → book_service.create_book_from_upload()                      │
│   → process_book_task.delay(book.id)  ← Celery task запущен    │
│   → Response: BookUploadResponse                                │
│                                                                  │
│ Результат:                                                       │
│   • Book: is_parsed=False, is_processing=True                   │
│   • Chapters: is_description_parsed=False, is_service_page=NULL │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: ASYNC PROCESSING (Асинхронная, ~10-30s)               │
├─────────────────────────────────────────────────────────────────┤
│ process_book_task (Celery worker)                               │
│   → Парсит ПЕРВЫЕ 5 ГЛАВ через LLM (предзагрузка)              │
│   → Пропускает служебные страницы (ToC, Copyright, etc.)       │
│   → Batch commit в КОНЦЕ (после всех 5 глав)                    │
│                                                                  │
│ Результат:                                                       │
│   • Главы 1-5: is_description_parsed=True                       │
│   • Служебные: descriptions_found=0                             │
│   • Нормальные: descriptions_found=5-15                         │
│   • Book: is_parsed=True, is_processing=False                   │
│                                                                  │
│ ⚠️ RACE CONDITION WINDOW: 10-30 секунд                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: ON-DEMAND EXTRACTION (При открытии, ~5-10s)           │
├─────────────────────────────────────────────────────────────────┤
│ GET /api/v1/books/{book_id}/chapters/{N}/descriptions          │
│   → Только для глав 6+ (или не обработанных в Phase 2)         │
│   → Проверяет is_service_page                                   │
│   → Если НЕ служебная: LLM extraction с distributed lock        │
│   → Кэширует результат в Redis (1 hour TTL)                     │
│                                                                  │
│ Результат:                                                       │
│   • Глава N: is_description_parsed=True                         │
│   • descriptions_found > 0 (или 0 если служебная)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Критическая Проблема: Race Condition

### Сценарий

```
T=0s     Пользователь загружает книгу
         ├─ chapter.is_service_page = NULL
         └─ chapter.is_description_parsed = False

T=1s     Celery task начинает обработку
         └─ Определяет: is_service_page = False (НЕ commit)

T=3s     🚨 ПОЛЬЗОВАТЕЛЬ ОТКРЫВАЕТ ГЛАВУ 1 (ДО commit Celery!)
         ├─ API endpoint: check_is_service_page() → TRUE (неправильно!)
         ├─ API endpoint: COMMIT is_service_page = True СРАЗУ
         └─ API endpoint: Возвращает empty result

T=15s    Celery task завершается
         ├─ Celery: COMMIT is_service_page = False (ПОЗЖЕ)
         └─ ⚠️ DB CONFLICT: кто победит?

T=∞      Глава 1 остается без описаний НАВСЕГДА
         ├─ is_description_parsed = True (обработана)
         ├─ descriptions_found = 0 (пустая)
         └─ Frontend не вызывает extract_new=true
```

### Root Causes

1. **Batch Commit в Celery Task (P2.2 Optimization)**
   - `is_service_page` определяется для 5 глав, но commit ОДИН в конце
   - Временное окно: 10-30 секунд

2. **Немедленный Commit в descriptions.py (P1.1 Optimization)**
   - Кэширует `is_service_page` сразу при первом запросе
   - Конфликт: происходит ДО завершения Celery task

3. **Нет Distributed Lock на Уровне Главы**
   - Celery task и API endpoint записывают в одну главу параллельно
   - Нет синхронизации

4. **check_is_service_page() Недетерминистическая**
   - Первые 500 символов недостаточно
   - "Пролог" (5000 слов) = ложноположительное срабатывание

---

## Затронутые Файлы

```
backend/app/routers/books/crud.py:56-200
  ├─ upload_book() - Phase 1
  └─ Запускает process_book_task.delay()

backend/app/core/tasks.py:52-264
  ├─ process_book_task() - Phase 2
  ├─ Парсит первые 5 глав
  ├─ Определяет is_service_page
  └─ 💾 BATCH COMMIT (строка 230-233)

backend/app/routers/descriptions.py:47-321
  ├─ get_chapter_descriptions() - Phase 3
  ├─ Проверяет is_service_page
  ├─ 💾 COMMIT СРАЗУ (строка 99-102)
  └─ 🚨 RACE CONDITION HAPPENS HERE

backend/app/models/chapter.py:140-167
  ├─ check_is_service_page() - Detection logic
  └─ 🐛 Недетерминистическая функция

backend/app/services/book_parser.py:836-864
  └─ parse_book() - Парсинг файла в главы

backend/app/services/langextract_processor.py
  └─ extract_descriptions() - LLM extraction (Gemini API)
```

---

## P0 Fixes (СРОЧНО)

### FIX 1: Distributed Lock для is_service_page

**Файл:** `backend/app/routers/descriptions.py:95-102`

**Что делать:**
Обернуть кэширование `is_service_page` в distributed lock, чтобы предотвратить параллельную запись с Celery task.

**Код:**
```python
lock_key = f"chapter_metadata_lock:{chapter.id}"
lock_acquired = await cache_manager.acquire_lock(lock_key, ttl=60)

if lock_acquired:
    try:
        if chapter.is_service_page is None:
            chapter.is_service_page = is_service_page
            await db.commit()
    finally:
        await cache_manager.release_lock(lock_key)
```

**Эффект:** Полностью устраняет race condition #1.

---

### FIX 2: Commit is_service_page СРАЗУ в Celery Task

**Файл:** `backend/app/core/tasks.py:172-179`

**Что делать:**
Коммитить `is_service_page` сразу после определения (до batch commit описаний).

**Код:**
```python
lock_key = f"chapter_metadata_lock:{chapter.id}"
lock_acquired = await cache_manager.acquire_lock(lock_key, ttl=60)

if lock_acquired:
    try:
        if chapter.is_service_page is None:
            chapter.is_service_page = is_service_page
            await db.commit()  # 💾 COMMIT IMMEDIATELY
    finally:
        await cache_manager.release_lock(lock_key)
```

**Эффект:** Уменьшает race window с 30s до <1s.

---

## P1 Fixes (Важно)

### FIX 3: Улучшить check_is_service_page()

**Файл:** `backend/app/models/chapter.py:140-167`

**Проблемы:**
1. Первые 500 символов недостаточно → увеличить до 2000
2. "Пролог" (5000 слов) = false positive → добавить исключение
3. Один match = служебная → требовать >=3 matches

**Код:**
```python
def check_is_service_page(self) -> bool:
    # ИСКЛЮЧЕНИЕ: "Пролог"/"Эпилог" с большим word_count
    if ("пролог" in title_lower or "эпилог" in title_lower):
        if self.word_count > 500:
            return False

    # Проверяем контент (2000 символов вместо 500)
    content_sample = self.content[:2000].lower()

    # Требуем >= 3 keyword matches
    keyword_matches = sum(
        1 for kw in SERVICE_PAGE_KEYWORDS if kw in content_sample
    )
    return keyword_matches >= 3
```

---

## P2 Fixes (Долгосрочное)

### FIX 4: Endpoint для Переобработки

**Файл:** `backend/app/routers/descriptions.py` (новый endpoint)

**Цель:** Позволить пользователям исправить неправильно определенные служебные страницы.

**Endpoint:**
```python
POST /api/v1/books/{book_id}/chapters/{chapter_number}/reprocess

# Сбрасывает:
chapter.is_description_parsed = False
chapter.is_service_page = None
chapter.descriptions_found = 0

# Вызывает:
get_chapter_descriptions(extract_new=True)
```

---

## Временная Диаграмма

```
NORMAL FLOW (No Race Condition)
────────────────────────────────────────────────────────────────
T=0s    │ Upload завершен
        │ chapter.is_service_page = NULL
        │
T=1s    │ CELERY: Start processing
        │
T=2s    │ CELERY: Determine is_service_page = False
        │ CELERY: Extract 10 descriptions via LLM
        │
T=15s   │ CELERY: BATCH COMMIT
        │ chapter.is_service_page = False
        │ chapter.descriptions_found = 10
        │ ✅ COMMITTED TO DB
        │
T=20s   │ USER: Opens chapter 1
        │ API: Reads is_service_page = False (from DB)
        │ API: Returns 10 descriptions
        │ ✅ SUCCESS


RACE CONDITION (Problem!)
────────────────────────────────────────────────────────────────
T=0s    │ Upload завершен
        │ chapter.is_service_page = NULL
        │
T=1s    │ CELERY: Start processing
        │
T=2s    │ CELERY: Determine is_service_page = False
        │ (NOT COMMITTED YET!)
        │
T=3s    │ 🚨 USER: Opens chapter 1 (BEFORE CELERY COMMIT!)
        │ API: chapter.is_service_page = NULL (from DB)
        │ API: check_is_service_page() → TRUE (WRONG!)
        │
T=3.1s  │ API: COMMIT is_service_page = TRUE
        │ ⚠️ LOCKED IN DATABASE
        │
T=5s    │ CELERY: Extract 10 descriptions
        │
T=15s   │ CELERY: BATCH COMMIT
        │ chapter.is_service_page = FALSE (CONFLICT!)
        │ chapter.descriptions_found = 10
        │ ⚠️ DB CONFLICT (who wins?)
        │
T=20s   │ USER: Refreshes page
        │ API: chapter.is_service_page = TRUE (from DB)
        │ API: Returns EMPTY (0 descriptions)
        │ ❌ FAILURE - User sees no descriptions!
```

---

## Testing Plan

### 1. Unit Tests
```python
test_race_condition_is_service_page()
test_prologue_not_service_page()
test_distributed_lock_prevents_conflict()
```

### 2. Integration Tests
```python
test_concurrent_upload_and_open()
test_batch_commit_timing()
test_reprocess_endpoint()
```

### 3. Load Tests
```bash
# Simulate 100 concurrent uploads
ab -n 100 -c 10 -T 'multipart/form-data' \
   https://fancai.ru/api/v1/books/upload
```

---

## Мониторинг

### Grafana Alerts

```promql
# is_service_page conflicts
count by (chapter_id) (
  chapter_service_page_check{source="celery_task"} != bool
  chapter_service_page_check{source="api_endpoint"}
)
```

### Логи

```python
# В Celery task
logger.info("chapter_metadata_update", extra={
    "chapter_id": str(chapter.id),
    "is_service_page": is_service_page,
    "source": "celery_task",
    "lock_acquired": lock_acquired,
})

# В API endpoint
logger.info("chapter_metadata_update", extra={
    "chapter_id": str(chapter.id),
    "is_service_page": is_service_page,
    "source": "api_endpoint",
    "lock_acquired": lock_acquired,
})
```

---

## Rollout Plan

```
Stage 1: Code Review (30 min)
  ├─ Review FIX 1 и FIX 2
  └─ Проверить distributed lock logic

Stage 2: Testing (1 hour)
  ├─ Unit tests
  ├─ Integration tests
  └─ Manual testing

Stage 3: Staging (30 min)
  ├─ Deploy на staging
  └─ Load testing (100+ uploads)

Stage 4: Production (Канареечный релиз)
  ├─ Deploy на 10% servers
  ├─ Monitor 24 hours
  └─ Gradual rollout to 100%

Stage 5: Monitoring (Постоянно)
  ├─ Grafana alerts
  ├─ Weekly log review
  └─ User feedback
```

---

## Summary

| Метрика | Значение |
|---------|----------|
| **Серьезность** | CRITICAL (P0) |
| **Временное окно** | 10-30 секунд |
| **Affected Users** | Все, кто открывает главу 1 сразу после загрузки |
| **Затронутые главы** | Главы 1-5 (обрабатываемые в Celery task) |
| **Root Cause** | Отсутствие distributed lock + batch commit |
| **Estimated Fix Time** | 2-4 hours |
| **Risk Level** | HIGH (может привести к потере данных) |
| **Impact** | HIGH (пользователи не видят описаний) |

---

## Ссылки

- **Полный Анализ:** `docs/reports/2025-12-25_book_parsing_workflow_analysis.md`
- **Критический FIX:** `CRITICAL_RACE_CONDITION_FIX.md`
- **Диаграмма:** `docs/diagrams/book-parsing-workflow.mermaid`

---

**Конец Summary**
