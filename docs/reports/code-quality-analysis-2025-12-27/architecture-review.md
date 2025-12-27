# Архитектурный Review: SOLID и Clean Architecture

**Дата:** 27 декабря 2025
**Оценка:** 7.5/10

---

## Резюме

Архитектура проекта следует многим хорошим практикам, но есть критические пробелы: in-memory очередь генерации изображений, отсутствие DI, отсутствие Circuit Breaker для внешних API.

---

## Критические Проблемы

### P0-001: In-memory generation queue

**Файл:** `app/services/image_generator.py:76`

**Проблема:**
```python
class ImageGenerator:
    def __init__(self):
        self._generation_queue = []  # Теряется при перезапуске!
```

**Решение:**
```python
# Использовать Redis или Celery для очереди
from celery import shared_task

@shared_task(bind=True, max_retries=3)
def generate_image_task(self, description_id: int):
    # Генерация в Celery worker
    pass
```

**Риск:** Потеря всех pending генераций при перезапуске сервера.

---

### P1-001: Отсутствие Dependency Injection

**Проблема:** Сервисы создаются как глобальные синглтоны.

**Файлы:**
- `app/services/book_service.py:400-401`
- `app/services/auth_service.py:372-373`

**Текущее состояние:**
```python
# В конце каждого сервиса
book_service = BookService()  # Глобальный экземпляр

# В роутере
from app.services.book_service import book_service
```

**Решение (FastAPI DI):**
```python
# app/core/dependencies.py
def get_book_service(db: AsyncSession = Depends(get_db)):
    return BookService(db)

# В роутере
@router.get("/books")
async def list_books(
    service: BookService = Depends(get_book_service)
):
    return await service.list()
```

---

### P1-002: Отсутствие Circuit Breaker

**Файлы:**
- `app/services/gemini_extractor.py`
- `app/services/imagen_generator.py`

**Проблема:** При падении Gemini/Imagen API все запросы будут таймаутиться.

**Решение:**
```python
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=60)
async def call_gemini_api(prompt: str):
    # ...
```

---

## SOLID Анализ

### Single Responsibility Principle (SRP)

| Файл | Нарушение | Рекомендация |
|------|-----------|--------------|
| `book_parser.py` (925 строк) | Парсинг + CFI + валидация | Разбить на BookParser, CfiGenerator, Validator |
| `book.py:207-267` | ORM + бизнес-логика | Вынести логику в BookProgressService |

### Open/Closed Principle (OCP) ✅

Хорошо: Стратегии выделения описаний в `useDescriptionHighlighting.ts` расширяемы.

### Liskov Substitution Principle (LSP) ✅

Хорошо: Сервисы следуют LSP.

### Interface Segregation Principle (ISP)

| Файл | Нарушение | Рекомендация |
|------|-----------|--------------|
| `IBookService` | 15+ методов | Разбить на IBookReader, IBookWriter, IBookSearch |

### Dependency Inversion Principle (DIP)

| Файл | Нарушение | Рекомендация |
|------|-----------|--------------|
| Все сервисы | Зависят от конкретных реализаций | Использовать Protocol/ABC |

---

## Архитектурные Паттерны

### Что Используется ✅

1. **Repository Pattern** — частично (BookRepository)
2. **Service Layer** — да
3. **Factory Pattern** — для создания сервисов
4. **Strategy Pattern** — в highlighting

### Что Отсутствует ❌

1. **Circuit Breaker** — для внешних API
2. **Retry Pattern** — с exponential backoff
3. **CQRS** — разделение чтения/записи
4. **Event Sourcing** — для аудита

---

## Рекомендации по Рефакторингу

### Фаза 1: Критические (3-4 дня)

| Задача | Файлы | Часы |
|--------|-------|------|
| Перенести очередь в Redis/Celery | image_generator.py | 8 |
| Внедрить Circuit Breaker | gemini_extractor.py, imagen_generator.py | 8 |

### Фаза 2: Важные (5-7 дней)

| Задача | Файлы | Часы |
|--------|-------|------|
| Внедрить DI через FastAPI | Все сервисы | 24 |
| Разбить book_parser.py | book/, parsers/ | 16 |

---

## Диаграмма Текущей Архитектуры

```
┌──────────────────────────────────────────────────────────┐
│                      Frontend (React)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ TanStack Q  │  │   Zustand   │  │   IndexedDB     │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼───────────────────────────────┐
│                      Backend (FastAPI)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Routers   │──│  Services   │──│     Models      │   │
│  │ (endpoints) │  │ (logic)     │  │   (SQLAlchemy)  │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
│                          │                                │
│  ┌───────────────────────▼────────────────────────────┐  │
│  │                 External APIs                       │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │  Gemini  │  │  Imagen  │  │   Pollinations   │  │  │
│  │  │   API    │  │   API    │  │   (fallback)     │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                    Infrastructure                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │ PostgreSQL  │  │    Redis    │  │     Celery      │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Целевая Архитектура

```
Services ────┬──── Circuit Breaker ──── External APIs
             │
             └──── Redis Queue ──── Celery Workers
             │
             └──── FastAPI DI ──── Repository ──── Database
```

---

*Анализ выполнен агентом Architect Review (Claude Opus 4.5)*
