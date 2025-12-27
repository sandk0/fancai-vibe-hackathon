# Backend Анализ: FastAPI + Python

**Дата:** 27 декабря 2025
**Оценка:** 7.5/10

---

## Резюме

Backend BookReader AI построен на FastAPI с async SQLAlchemy. Архитектура в целом хорошая, но есть проблемы с устаревшими паттернами asyncio, использованием print вместо logging, и глобальными синглтонами вместо DI.

---

## Критические Проблемы

### P1-001: Deprecated asyncio паттерн

**Файлы:**
- `app/services/imagen_generator.py`
- `app/services/gemini_extractor.py`

**Проблема:**
```python
# Устаревший паттерн
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(None, sync_function)
```

**Решение:**
```python
# Современный подход (Python 3.9+)
result = await asyncio.to_thread(sync_function)
```

**Риск:** В Python 3.12+ `get_event_loop()` выбрасывает DeprecationWarning, в будущих версиях может сломаться.

---

### P1-002: print() вместо logging

**Количество:** 453 вызова `print()` в production коде

**Файлы:**
- `app/main.py` — startup/shutdown логи
- `app/tasks.py` — Celery задачи
- `app/routers/books/crud.py` — CRUD операции

**Проблема:**
```python
print(f"Processing book {book_id}")  # Плохо
```

**Решение:**
```python
import logging
logger = logging.getLogger(__name__)
logger.info(f"Processing book {book_id}")  # Хорошо
```

**Риск:** Потеря логов в production, невозможность фильтрации по уровню, отсутствие ротации.

---

### P1-003: Бизнес-логика в ORM моделях

**Файл:** `app/models/book.py:207-267`

**Проблема:**
```python
class Book(Base):
    # ... поля ...

    def calculate_progress(self):  # Бизнес-логика в модели
        # 60 строк кода
        pass
```

**Решение:** Вынести в отдельный сервис `BookProgressService`.

**Риск:** Нарушение Single Responsibility, сложность тестирования.

---

### P2-001: Глобальные синглтоны

**Файлы:**
- `app/services/book_service.py:400-401`
- `app/services/auth_service.py:372-373`

**Проблема:**
```python
# В конце файла
book_service = BookService()  # Глобальный экземпляр
```

**Решение:**
```python
# Dependency Injection через FastAPI
def get_book_service(db: AsyncSession = Depends(get_db)):
    return BookService(db)

@router.get("/books")
async def get_books(service: BookService = Depends(get_book_service)):
    return await service.list()
```

---

## Положительные Аспекты

1. **Async/await везде** — правильное использование асинхронности
2. **Pydantic schemas** — строгая валидация входных данных
3. **Repository pattern** — разделение доступа к данным
4. **Celery tasks** — фоновые задачи вынесены из request handler
5. **Rate limiting** — защита от злоупотреблений

---

## Рекомендации по Рефакторингу

### Фаза 1: Критические (1-2 дня)

| Задача | Файлы | Часы |
|--------|-------|------|
| Заменить `get_event_loop()` на `asyncio.to_thread()` | imagen_generator.py, gemini_extractor.py | 2 |
| Заменить print() на logging | main.py, tasks.py, crud.py | 4 |

### Фаза 2: Важные (3-5 дней)

| Задача | Файлы | Часы |
|--------|-------|------|
| Внедрить DI через FastAPI Depends | Все сервисы | 16 |
| Вынести бизнес-логику из моделей | book.py, user.py | 8 |

---

## Файлы для Изменения

| Приоритет | Файл | Изменение |
|-----------|------|-----------|
| P1 | `app/services/imagen_generator.py` | asyncio.to_thread() |
| P1 | `app/services/gemini_extractor.py` | asyncio.to_thread() |
| P1 | `app/main.py` | Заменить print на logging |
| P1 | `app/tasks.py` | Заменить print на logging |
| P2 | `app/services/book_service.py` | DI pattern |
| P2 | `app/models/book.py` | Вынести бизнес-логику |

---

*Анализ выполнен агентом Backend Architect (Claude Opus 4.5)*
