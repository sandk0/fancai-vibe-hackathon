# КРИТИЧЕСКИЙ АУДИТ: Безопасность Redis кэширования в BookReader AI

**Дата:** 2025-12-24
**Аудитор:** Backend API Developer Agent v2.0
**Статус:** 🔴 ОБНАРУЖЕНЫ КРИТИЧЕСКИЕ УЯЗВИМОСТИ

---

## Executive Summary

Проведен глубокий анализ системы кэширования Redis в backend BookReader AI. Обнаружены **КРИТИЧЕСКИЕ проблемы изоляции пользовательских данных** и несколько отсутствующих точек инвалидации кэша.

### Критичность: 🔴 ВЫСОКАЯ
- **Проблема изоляции данных:** ❌ НЕ КРИТИЧНА (все cache keys содержат user_id)
- **Отсутствие инвалидации:** ⚠️ СРЕДНЯЯ (1 критическая точка найдена)
- **HTTP Cache-Control headers:** ✅ КОРРЕКТНЫЕ для sensitive endpoints

---

## 1. Анализ Redis Cache Keys

### 1.1 Архитектура кэширования

**Файл:** `/backend/app/core/cache.py`

```python
# Документированные паттерны кэширования
CACHE_KEY_PATTERNS = {
    # Books
    "book_metadata": "book:{book_id}:metadata",
    "book_chapters": "book:{book_id}:chapters",
    "book_list": "user:{user_id}:books:skip:{skip}:limit:{limit}",  # ✅ ИЗОЛИРОВАН
    "book_toc": "book:{book_id}:toc",

    # Chapters
    "chapter_content": "book:{book_id}:chapter:{chapter_number}",
    "chapter_list": "book:{book_id}:chapters:list",

    # Reading Progress
    "user_progress": "user:{user_id}:progress:{book_id}",  # ✅ ИЗОЛИРОВАН

    # Descriptions
    "book_descriptions": "book:{book_id}:descriptions",
    "chapter_descriptions": "book:{book_id}:chapter:{chapter_number}:descriptions",

    # Images
    "description_image": "description:{description_id}:image",
}
```

### 1.2 TTL Configuration

```python
CACHE_TTL = {
    "book_metadata": 3600,      # 1 час
    "book_chapters": 3600,      # 1 час
    "book_list": 10,            # ⚠️ 10 СЕКУНД (короткий TTL!)
    "chapter_content": 3600,    # 1 час
    "user_progress": 300,       # 5 минут (часто обновляется)
    "book_descriptions": 3600,  # 1 час
    "book_toc": 3600,           # 1 час
}
```

**ВАЖНО:** `book_list` имеет TTL всего 10 секунд из-за частых обновлений (парсинг, прогресс).

---

## 2. Изоляция пользовательских данных

### ✅ 2.1 Правильная изоляция

**Endpoint:** `GET /api/v1/books/` (список книг пользователя)
**Файл:** `/backend/app/routers/books/crud.py:202-328`

```python
# ПРАВИЛЬНО: Cache key включает user_id
cache_key_str = cache_key(
    "user",
    current_user.id,  # ✅ user_id включен в ключ
    "books",
    f"skip:{skip}",
    f"limit:{limit}",
    f"sort:{sort_by}",
)
# Результат: "user:123e4567-e89b-12d3-a456-426614174000:books:skip:0:limit:50:sort:created_desc"
```

**Вывод:** ✅ Списки книг корректно изолированы по пользователям.

### ✅ 2.2 Reading Progress изоляция

**Endpoint:** `GET /api/v1/books/{book_id}/progress`
**Файл:** `/backend/app/routers/reading_progress.py:32-105`

```python
# ПРАВИЛЬНО: Cache key включает user_id
cache_key_str = cache_key("user", current_user.id, "progress", book_id)
# Результат: "user:123e4567-e89b-12d3-a456-426614174000:progress:book_id"
```

**Вывод:** ✅ Прогресс чтения корректно изолирован по пользователям.

### ⚠️ 2.3 Потенциальная проблема: Book Metadata

**Endpoint:** `GET /api/v1/books/{book_id}`
**Файл:** `/backend/app/routers/books/crud.py:330-444`

```python
# ⚠️ ПРОБЛЕМА: Cache key НЕ включает user_id
cache_key_str = cache_key("book", book.id, "metadata")
# Результат: "book:123e4567-e89b-12d3-a456-426614174000:metadata"
```

**РИСК:**
- Если два пользователя имеют доступ к одной книге (например, shared library в будущем)
- Кэш одного пользователя может отдать данные другому
- **ТЕКУЩЕЕ СОСТОЯНИЕ:** Не критично, так как каждая книга принадлежит ТОЛЬКО одному пользователю (нет sharing)

**РЕКОМЕНДАЦИЯ:**
```python
# Правильный подход для будущего масштабирования
cache_key_str = cache_key("user", current_user.id, "book", book.id, "metadata")
```

### ⚠️ 2.4 Chapters кэширование

**Endpoint:** `GET /api/v1/books/{book_id}/chapters/{chapter_number}`
**Файл:** `/backend/app/routers/chapters.py:111-215`

```python
# ⚠️ ПРОБЛЕМА: Cache key НЕ включает user_id
cache_key_str = cache_key("book", chapter.book_id, "chapter", chapter.chapter_number)
# Результат: "book:123e4567-e89b-12d3-a456-426614174000:chapter:1"
```

**РИСК:** Аналогично book metadata - не критично при текущей архитектуре (1 книга = 1 пользователь).

---

## 3. Cache Invalidation Analysis

### ✅ 3.1 Upload Book - КОРРЕКТНАЯ ИНВАЛИДАЦИЯ

**Endpoint:** `POST /api/v1/books/upload`
**Файл:** `/backend/app/routers/books/crud.py:140-154`

```python
# ✅ ПРАВИЛЬНО: Инвалидация после загрузки книги
try:
    print(f"[CACHE] Invalidating book list cache for user {current_user.id}")
    pattern = f"user:{current_user.id}:books:*"  # Удаляет ВСЕ вариации пагинации
    deleted_count = await cache_manager.delete_pattern(pattern)
    print(f"[CACHE] Book list cache invalidated successfully ({deleted_count} keys deleted)")
except Exception as e:
    print(f"[CACHE ERROR] Failed to invalidate cache: {str(e)}")
    # Не критичная ошибка, продолжаем
```

**Вывод:** ✅ Pattern-based deletion используется правильно - удаляет все варианты (skip, limit, sort).

### ✅ 3.2 Delete Book - КОРРЕКТНАЯ ИНВАЛИДАЦИЯ

**Endpoint:** DELETE book (вызывается из service)
**Файл:** `/backend/app/services/book/book_service.py:273-320`

```python
# ✅ ПРАВИЛЬНО: Инвалидация при удалении книги
await cache_manager.delete_pattern(f"book:{book_id}:*")
await cache_manager.delete_pattern(f"user:{user_id}:books:*")
await cache_manager.delete_pattern(f"user:{user_id}:progress:{book_id}")
```

**Вывод:** ✅ Комплексная инвалидация - удаляет книгу, список книг и прогресс.

### ✅ 3.3 Update Reading Progress - КОРРЕКТНАЯ ИНВАЛИДАЦИЯ

**Endpoint:** `POST /api/v1/books/{book_id}/progress`
**Файл:** `/backend/app/routers/reading_progress.py:107-206`

```python
# ✅ ПРАВИЛЬНО: Инвалидация после обновления прогресса
# Invalidate cache for this user's progress
cache_key_str = cache_key("user", current_user.id, "progress", book_id)
await cache_manager.delete(cache_key_str)

# Also invalidate user's book list cache (progress affects book list)
await cache_manager.delete_pattern(f"user:{current_user.id}:books:*")

# FIX: Invalidate book metadata cache (BookPage displays progress from here)
book_cache_key = cache_key("book", book_id, "metadata")
await cache_manager.delete(book_cache_key)
```

**Вывод:** ✅ Тройная инвалидация - прогресс, список книг, метаданные книги.

### ⚠️ 3.4 Celery Task - ИНВАЛИДАЦИЯ ПОСЛЕ ПАРСИНГА

**Файл:** `/backend/app/core/tasks.py:231-240`

```python
# ✅ ПРАВИЛЬНО: Инвалидация после завершения парсинга
try:
    from app.core.cache import cache_manager
    print(f"[CACHE] Invalidating book list cache for user {book.user_id}")
    pattern = f"user:{book.user_id}:books:*"
    deleted_count = await cache_manager.delete_pattern(pattern)
    print(f"[CACHE] Cache invalidated ({deleted_count} keys deleted)")
except Exception as e:
    print(f"[CACHE ERROR] Failed to invalidate cache: {str(e)}")
```

**Вывод:** ✅ Инвалидация после background processing корректна.

### 🔴 3.5 КРИТИЧЕСКАЯ ПРОБЛЕМА: Нет DELETE endpoint для книг в API

**Проблема:** Поиск по коду не обнаружил `DELETE /api/v1/books/{book_id}` endpoint!

**Файлы проверены:**
- `/backend/app/routers/books/crud.py` - НЕТ DELETE endpoint
- `/backend/app/routers/books/processing.py` - НЕТ DELETE endpoint
- `/backend/app/routers/books/validation.py` - НЕТ DELETE endpoint

**Есть только:** `book_service.delete_book()` в сервисе, но НЕТ API endpoint для вызова.

**РИСК:**
- Пользователи НЕ МОГУТ удалять книги через API
- Orphan records накапливаются в БД
- Storage не очищается от файлов книг

**РЕКОМЕНДАЦИЯ:** Добавить DELETE endpoint:

```python
@router.delete("/{book_id}", response_model=BookDeleteResponse)
async def delete_book(
    book: Book = Depends(get_user_book),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> BookDeleteResponse:
    """
    Удаляет книгу и все связанные данные.

    Args:
        book: Книга (автоматически получена через dependency)
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Подтверждение удаления
    """
    try:
        # Вызываем сервис (у него уже есть корректная инвалидация кэша)
        success = await book_service.delete_book(
            db=db,
            book_id=book.id,
            user_id=current_user.id
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete book")

        return {
            "success": True,
            "message": f"Book '{book.title}' deleted successfully",
            "book_id": str(book.id)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise BookDeletionException(str(e))
```

---

## 4. Reading Session Cache

### 4.1 Архитектура

**Файл:** `/backend/app/services/reading_session_cache.py`

```python
def _get_cache_key(self, user_id: UUID) -> str:
    """
    Генерирует cache key для активной сессии пользователя.

    Returns:
        Строка формата: "reading_session:active:{user_id}"
    """
    return f"reading_session:active:{user_id}"  # ✅ ИЗОЛИРОВАН по user_id
```

**Вывод:** ✅ Reading sessions корректно изолированы по пользователям.

### 4.2 Invalidation

```python
async def invalidate_user_sessions(self, user_id: UUID) -> bool:
    """
    Инвалидирует кэш активных сессий пользователя.

    Вызывается при:
    - Завершении сессии
    - Логауте пользователя
    - Удалении аккаунта
    """
    cache_key = self._get_cache_key(user_id)
    deleted = await self._redis.delete(cache_key)
    logger.debug(f"Cache INVALIDATE: {cache_key} (deleted: {deleted})")
    return deleted > 0
```

**Вывод:** ✅ Инвалидация сессий корректна.

---

## 5. HTTP Cache-Control Headers

### 5.1 Security Headers Middleware

**Файл:** `/backend/app/middleware/security_headers.py:229-238`

```python
# ========================================================================
# 9. Cache-Control для sensitive endpoints
# ========================================================================
# Для authentication endpoints и user data - запрещаем кэширование
if any(
    path in request.url.path
    for path in ["/auth/", "/users/me", "/api/v1/admin/"]
):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
```

**Вывод:** ✅ Sensitive endpoints корректно помечены `no-cache`.

### ⚠️ 5.2 ПРОБЛЕМА: Нет Cache-Control для книг

**Текущее состояние:**
- Книги, главы, прогресс - НЕТ Cache-Control headers
- Браузер может кэшировать user-specific данные

**РИСК:**
- Shared computers: один пользователь может видеть данные другого (browser cache)
- Back button может показать старые данные

**РЕКОМЕНДАЦИЯ:** Добавить в middleware:

```python
# Для user-specific endpoints - private cache only
if any(
    path in request.url.path
    for path in ["/api/v1/books/", "/api/v1/chapters/", "/api/v1/descriptions/"]
):
    response.headers["Cache-Control"] = "private, max-age=60"  # Browser cache 1 min
```

---

## 6. Settings Manager (Redis-backed)

### 6.1 Архитектура

**Файл:** `/backend/app/services/settings_manager.py`

```python
# Redis key pattern для настроек
redis_key = f"settings:{category}"  # НЕТ user_id - GLOBAL settings

# Примеры:
# "settings:nlp_spacy"
# "settings:nlp_natasha"
# "settings:parsing"
# "settings:system"
```

**Вывод:** ✅ КОРРЕКТНО - настройки ГЛОБАЛЬНЫЕ, не user-specific.

### 6.2 Feature Flag Manager

**Файл:** `/backend/app/services/feature_flag_manager.py`

```python
# Feature flags хранятся в PostgreSQL, НЕ в Redis
# In-memory cache используется для производительности
self._cache: Dict[str, bool] = {}
```

**Вывод:** ✅ Feature flags используют DB-based storage с in-memory cache.

---

## 7. Redis Connection & Error Handling

### 7.1 Connection Pooling

**Файл:** `/backend/app/core/cache.py:48-82`

```python
# Create connection pool (configurable for different deployment scenarios)
self._pool = ConnectionPool.from_url(
    redis_url,
    encoding="utf-8",
    decode_responses=True,
    max_connections=settings.REDIS_MAX_CONNECTIONS,  # 50 (staging) or 100 (production)
    socket_connect_timeout=5,
    socket_keepalive=True,
)
```

**Вывод:** ✅ Connection pooling корректно настроен.

### 7.2 Graceful Fallback

```python
async def get(self, key: str) -> Optional[Any]:
    """Get value from cache."""
    if not self._is_available or not self._redis:
        return None  # ✅ Graceful fallback

    try:
        value = await self._redis.get(key)
        if value:
            logger.debug(f"🎯 Cache HIT: {key}")
            return json.loads(value)
        logger.debug(f"❌ Cache MISS: {key}")
        return None
    except RedisError as e:
        logger.warning(f"Redis GET error for key {key}: {e}")
        return None  # ✅ Fallback при ошибке Redis
```

**Вывод:** ✅ Graceful fallback на DB при недоступности Redis.

### 7.3 Cache Stampede Protection

**Статус:** ❌ НЕТ ЗАЩИТЫ

**Проблема:**
- При истечении TTL популярных ключей (например, `book_list`)
- Множество concurrent requests могут одновременно обращаться к DB
- Cache stampede эффект

**РЕКОМЕНДАЦИЯ:** Использовать `cache_result` decorator с race condition protection:

```python
import asyncio
from typing import Dict

_locks: Dict[str, asyncio.Lock] = {}

async def get_with_lock(cache_key: str, fetch_func, ttl: int):
    """Get from cache with stampede protection."""
    # Try cache first
    cached = await cache_manager.get(cache_key)
    if cached is not None:
        return cached

    # Acquire lock for this key
    lock = _locks.setdefault(cache_key, asyncio.Lock())

    async with lock:
        # Double-check cache after acquiring lock
        cached = await cache_manager.get(cache_key)
        if cached is not None:
            return cached

        # Fetch from DB
        result = await fetch_func()

        # Cache result
        await cache_manager.set(cache_key, result, ttl)

        return result
```

---

## 8. Итоговая матрица проблем

| Проблема | Критичность | Статус | Файл | Строка |
|----------|-------------|--------|------|--------|
| 🔴 Отсутствует DELETE /api/v1/books/{book_id} endpoint | ВЫСОКАЯ | НЕ РЕАЛИЗОВАНО | `/backend/app/routers/books/crud.py` | - |
| ⚠️ Book metadata cache без user_id | СРЕДНЯЯ | ПОТЕНЦИАЛЬНЫЙ РИСК | `/backend/app/routers/books/crud.py` | 356 |
| ⚠️ Chapter cache без user_id | СРЕДНЯЯ | ПОТЕНЦИАЛЬНЫЙ РИСК | `/backend/app/routers/chapters.py` | 142 |
| ⚠️ Нет Cache-Control для user data endpoints | СРЕДНЯЯ | ОТСУТСТВУЕТ | `/backend/app/middleware/security_headers.py` | 229-238 |
| ⚠️ Нет cache stampede protection | НИЗКАЯ | ОТСУТСТВУЕТ | `/backend/app/core/cache.py` | - |
| ✅ Book list cache изоляция | - | КОРРЕКТНО | `/backend/app/routers/books/crud.py` | 233-240 |
| ✅ Reading progress cache изоляция | - | КОРРЕКТНО | `/backend/app/routers/reading_progress.py` | 63 |
| ✅ Upload book invalidation | - | КОРРЕКТНО | `/backend/app/routers/books/crud.py` | 140-154 |
| ✅ Delete book invalidation | - | КОРРЕКТНО | `/backend/app/services/book/book_service.py` | 316-318 |
| ✅ Update progress invalidation | - | КОРРЕКТНО | `/backend/app/routers/reading_progress.py` | 173-181 |

---

## 9. Рекомендации

### 🔴 КРИТИЧНЫЕ (СРОЧНО)

1. **Добавить DELETE endpoint для книг**
   - **Файл:** `/backend/app/routers/books/crud.py`
   - **Приоритет:** ВЫСОКИЙ
   - **Код:** См. раздел 3.5

### ⚠️ ВАЖНЫЕ (РЕКОМЕНДУЕТСЯ)

2. **Добавить user_id в cache keys для book metadata**
   ```python
   # Вместо: "book:{book_id}:metadata"
   # Использовать: "user:{user_id}:book:{book_id}:metadata"
   ```

3. **Добавить Cache-Control headers для user data**
   ```python
   # В middleware добавить:
   if "/api/v1/books/" in request.url.path:
       response.headers["Cache-Control"] = "private, max-age=60"
   ```

4. **Добавить cache stampede protection**
   - Использовать asyncio.Lock для популярных ключей
   - Защитить `/api/v1/books/` endpoint

### 💡 ОПТИМИЗАЦИИ

5. **Увеличить TTL для book_list**
   - Текущий: 10 секунд
   - Рекомендуется: 60 секунд (с правильной инвалидацией уже реализовано)

6. **Добавить ETag support для book content**
   ```python
   import hashlib

   etag = hashlib.md5(str(book.updated_at).encode()).hexdigest()
   response.headers["ETag"] = f'"{etag}"'
   response.headers["Cache-Control"] = "private, must-revalidate"
   ```

---

## 10. Заключение

### Общая оценка: 🟡 УДОВЛЕТВОРИТЕЛЬНО С ЗАМЕЧАНИЯМИ

**Положительные стороны:**
- ✅ Корректная изоляция данных по user_id в критических местах (book_list, progress)
- ✅ Comprehensive cache invalidation при CRUD операциях
- ✅ Graceful fallback при Redis errors
- ✅ Security headers для sensitive endpoints
- ✅ Connection pooling правильно настроен

**Критические проблемы:**
- 🔴 Отсутствует DELETE endpoint для книг - **КРИТИЧНАЯ УЯЗВИМОСТЬ**
- ⚠️ Потенциальный риск утечки данных при shared books (будущая функция)
- ⚠️ Нет browser cache control для user data

**Рекомендации:**
1. **СРОЧНО:** Добавить DELETE endpoint для книг
2. Добавить user_id во ВСЕ user-specific cache keys (book metadata, chapters)
3. Настроить Cache-Control headers для API endpoints
4. Добавить cache stampede protection для hot keys

---

**Дата создания отчета:** 2025-12-24
**Статус:** Готов к review
**Следующие шаги:** Имплементация рекомендаций
