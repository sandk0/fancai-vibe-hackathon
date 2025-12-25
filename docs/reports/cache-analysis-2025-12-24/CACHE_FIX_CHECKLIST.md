# Cache Security Fix Checklist

**Приоритет выполнения:** Сверху вниз
**Дата создания:** 2025-12-24

---

## 🔴 P0 - КРИТИЧНЫЕ (Блокирующие)

### ✅ Task 1: Добавить DELETE endpoint для книг

**Проблема:** Пользователи не могут удалять книги через API

**Файл:** `/backend/app/routers/books/crud.py`

**Изменения:**

```python
# После get_book_cover() добавить:

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

    Raises:
        BookNotFoundException: Если книга не найдена
        BookAccessDeniedException: Если доступ запрещен
        BookDeletionException: Если ошибка удаления
    """
    try:
        # Сохраняем название для ответа
        book_title = book.title

        # Вызываем сервис (у него уже есть корректная инвалидация кэша)
        success = await book_service.delete_book(
            db=db,
            book_id=book.id,
            user_id=current_user.id
        )

        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete book - book not found or access denied"
            )

        return {
            "success": True,
            "message": f"Book '{book_title}' deleted successfully",
            "book_id": str(book.id)
        }

    except HTTPException:
        raise
    except Exception as e:
        from ...core.exceptions import BookDeletionException
        raise BookDeletionException(str(e))
```

**Также добавить в `/backend/app/schemas/responses.py`:**

```python
class BookDeleteResponse(BaseModel):
    """Response schema для удаления книги."""
    success: bool = Field(..., description="Успешность операции")
    message: str = Field(..., description="Сообщение об удалении")
    book_id: str = Field(..., description="ID удаленной книги")
```

**Также добавить в `/backend/app/core/exceptions.py`:**

```python
class BookDeletionException(HTTPException):
    """Ошибка при удалении книги."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete book: {detail}"
        )
```

**Тесты:**

```python
# /backend/tests/test_books_crud.py
async def test_delete_book(client, auth_headers, test_book):
    """Тест удаления книги."""
    response = client.delete(
        f"/api/v1/books/{test_book.id}",
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Проверяем, что книга удалена
    response = client.get(
        f"/api/v1/books/{test_book.id}",
        headers=auth_headers
    )
    assert response.status_code == 404


async def test_delete_book_not_owner(client, auth_headers, other_user_book):
    """Тест удаления чужой книги."""
    response = client.delete(
        f"/api/v1/books/{other_user_book.id}",
        headers=auth_headers
    )
    assert response.status_code == 403  # Access denied


async def test_delete_book_cache_invalidation(client, auth_headers, test_book):
    """Тест инвалидации кэша после удаления."""
    # Получаем список книг (кэшируем)
    response = client.get("/api/v1/books/", headers=auth_headers)
    books_before = len(response.json()["books"])

    # Удаляем книгу
    response = client.delete(f"/api/v1/books/{test_book.id}", headers=auth_headers)
    assert response.status_code == 200

    # Проверяем, что список обновился (кэш инвалидирован)
    response = client.get("/api/v1/books/", headers=auth_headers)
    books_after = len(response.json()["books"])
    assert books_after == books_before - 1
```

**Estimate:** 1-2 часа

**Acceptance Criteria:**
- [ ] DELETE endpoint реализован
- [ ] Возвращает корректный response
- [ ] Проверяет ownership (через get_user_book dependency)
- [ ] Инвалидирует кэш (уже реализовано в book_service.delete_book)
- [ ] Написаны тесты
- [ ] Документация обновлена (OpenAPI автоматически)

---

## ⚠️ P1 - ВАЖНЫЕ (Безопасность)

### ✅ Task 2: Добавить user_id в cache keys для book metadata

**Проблема:** Book metadata кэшируется без user_id → риск при shared books

**Файлы:**
- `/backend/app/routers/books/crud.py:356`
- `/backend/app/routers/chapters.py:142`

**Изменения:**

**1. Обновить `/backend/app/routers/books/crud.py`:**

```python
# В функции get_book() заменить:
# БЫЛО:
cache_key_str = cache_key("book", book.id, "metadata")

# СТАЛО:
cache_key_str = cache_key("user", current_user.id, "book", book.id, "metadata")
```

**2. Обновить `/backend/app/routers/chapters.py`:**

```python
# В функции list_chapters() заменить:
# БЫЛО:
cache_key_str = cache_key("book", book.id, "chapters", "list")

# СТАЛО:
cache_key_str = cache_key("user", current_user.id, "book", book.id, "chapters", "list")

# В функции get_chapter() заменить:
# БЫЛО:
cache_key_str = cache_key("book", chapter.book_id, "chapter", chapter.chapter_number)

# СТАЛО:
# Нужно получить current_user из dependencies
cache_key_str = cache_key("user", current_user.id, "book", chapter.book_id, "chapter", chapter.chapter_number)
```

**3. Обновить функции инвалидации:**

В `/backend/app/services/book/book_service.py:316-318`:

```python
# БЫЛО:
await cache_manager.delete_pattern(f"book:{book_id}:*")
await cache_manager.delete_pattern(f"user:{user_id}:books:*")
await cache_manager.delete_pattern(f"user:{user_id}:progress:{book_id}")

# СТАЛО (более точная инвалидация):
await cache_manager.delete_pattern(f"user:{user_id}:book:{book_id}:*")  # book metadata, chapters
await cache_manager.delete_pattern(f"user:{user_id}:books:*")          # book list
await cache_manager.delete_pattern(f"user:{user_id}:progress:{book_id}")  # progress
```

В `/backend/app/routers/reading_progress.py:181`:

```python
# БЫЛО:
book_cache_key = cache_key("book", book_id, "metadata")

# СТАЛО:
book_cache_key = cache_key("user", current_user.id, "book", book_id, "metadata")
```

**4. Обновить CACHE_KEY_PATTERNS в `/backend/app/core/cache.py`:**

```python
CACHE_KEY_PATTERNS = {
    # Books
    "book_metadata": "user:{user_id}:book:{book_id}:metadata",  # ОБНОВЛЕНО
    "book_chapters": "user:{user_id}:book:{book_id}:chapters",  # ОБНОВЛЕНО
    "book_list": "user:{user_id}:books:skip:{skip}:limit:{limit}",
    "book_toc": "user:{user_id}:book:{book_id}:toc",  # ОБНОВЛЕНО

    # Chapters
    "chapter_content": "user:{user_id}:book:{book_id}:chapter:{chapter_number}",  # ОБНОВЛЕНО
    "chapter_list": "user:{user_id}:book:{book_id}:chapters:list",  # ОБНОВЛЕНО

    # Reading Progress
    "user_progress": "user:{user_id}:progress:{book_id}",

    # Descriptions
    "book_descriptions": "user:{user_id}:book:{book_id}:descriptions",  # ОБНОВЛЕНО
    "chapter_descriptions": "user:{user_id}:book:{book_id}:chapter:{chapter_number}:descriptions",  # ОБНОВЛЕНО

    # Images
    "description_image": "description:{description_id}:image",  # Остается без user_id
}
```

**Estimate:** 2-3 часа

**Acceptance Criteria:**
- [ ] Все book/chapter cache keys включают user_id
- [ ] Инвалидация обновлена
- [ ] CACHE_KEY_PATTERNS документация обновлена
- [ ] Тесты проходят
- [ ] Нет регрессий в performance

---

### ✅ Task 3: Добавить Cache-Control headers для user data

**Проблема:** Браузер может кэшировать user-specific данные

**Файл:** `/backend/app/middleware/security_headers.py`

**Изменения:**

```python
# В функции dispatch() после строки 238 добавить:

        # ========================================================================
        # 10. Cache-Control для user-specific endpoints
        # ========================================================================
        # Для user-specific данных - разрешаем только private cache
        if any(
            path in request.url.path
            for path in [
                "/api/v1/books/",
                "/api/v1/chapters/",
                "/api/v1/descriptions/",
                "/api/v1/reading-progress/",
            ]
        ):
            response.headers["Cache-Control"] = "private, max-age=60"  # Browser cache 1 min
            response.headers["Vary"] = "Authorization"  # Cache per user (based on token)
```

**Также обновить docstring:**

```python
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware для добавления security headers ко всем HTTP responses.

    Реализует следующие защиты:
    1. HSTS (HTTP Strict Transport Security) - принудительный HTTPS
    2. CSP (Content Security Policy) - защита от XSS
    3. X-Frame-Options - защита от clickjacking
    4. X-Content-Type-Options - защита от MIME sniffing
    5. X-XSS-Protection - browser XSS protection
    6. Referrer-Policy - контроль referrer информации
    7. Permissions-Policy - отключение небезопасных API браузера
    8. Cache-Control для sensitive endpoints (auth, admin)
    9. Cache-Control для user-specific endpoints (books, chapters)  # ДОБАВЛЕНО

    Usage:
        app.add_middleware(SecurityHeadersMiddleware)
    """
```

**Estimate:** 30 минут

**Acceptance Criteria:**
- [ ] User data endpoints имеют `Cache-Control: private, max-age=60`
- [ ] Sensitive endpoints (auth, admin) остаются `no-store, no-cache`
- [ ] Vary: Authorization header добавлен
- [ ] Тесты обновлены

---

## 💡 P2 - ОПТИМИЗАЦИИ (Nice to have)

### ✅ Task 4: Добавить cache stampede protection

**Проблема:** Множество concurrent requests при истечении TTL

**Файл:** `/backend/app/core/cache.py`

**Изменения:**

```python
import asyncio
from typing import Dict, Callable, Any

# После class CacheManager:
_cache_locks: Dict[str, asyncio.Lock] = {}


class CacheManager:
    # ... существующий код ...

    async def get_or_set(
        self,
        key: str,
        fetch_func: Callable,
        ttl: Optional[Union[int, timedelta]] = None,
    ) -> Any:
        """
        Get value from cache or fetch and cache with stampede protection.

        Args:
            key: Cache key
            fetch_func: Async function to fetch data if cache miss
            ttl: Time-to-live for cached value

        Returns:
            Cached or fetched value

        Example:
            async def fetch_books():
                return await db.execute(select(Book))

            books = await cache_manager.get_or_set(
                "user:123:books",
                fetch_books,
                ttl=300
            )
        """
        # Try cache first
        cached = await self.get(key)
        if cached is not None:
            return cached

        # Acquire lock for this key
        lock = _cache_locks.setdefault(key, asyncio.Lock())

        async with lock:
            # Double-check cache after acquiring lock (другой request мог уже заполнить)
            cached = await self.get(key)
            if cached is not None:
                return cached

            # Fetch data
            result = await fetch_func()

            # Cache result
            await self.set(key, result, ttl)

            return result
```

**Пример использования в `/backend/app/routers/books/crud.py`:**

```python
# Вместо:
cached_result = await cache_manager.get(cache_key_str)
if cached_result is not None:
    return cached_result

# ... fetch from DB ...
response = {...}
await cache_manager.set(cache_key_str, response, ttl=CACHE_TTL["book_list"])
return response

# Использовать:
async def fetch_books_from_db():
    books_with_progress = await book_progress_service.get_books_with_progress(...)
    # ... формирование response ...
    return response

return await cache_manager.get_or_set(
    cache_key_str,
    fetch_books_from_db,
    ttl=CACHE_TTL["book_list"]
)
```

**Estimate:** 3-4 часа

**Acceptance Criteria:**
- [ ] get_or_set() метод реализован
- [ ] Locks правильно работают с asyncio
- [ ] Применен к hot endpoints (book_list, book_metadata)
- [ ] Load tests показывают улучшение при concurrent requests
- [ ] Нет deadlocks

---

### ✅ Task 5: Добавить ETag support для book content

**Проблема:** Неэффективная передача данных при повторных запросах

**Файл:** `/backend/app/routers/books/crud.py`

**Изменения:**

```python
import hashlib

@router.get("/{book_id}", response_model=BookDetailResponse)
async def get_book(
    book: Book = Depends(get_user_book),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
    request: Request,  # ДОБАВИТЬ
) -> BookDetailResponse:
    """Получает информацию о конкретной книге."""

    # Generate ETag based on book updated_at
    etag = hashlib.md5(str(book.updated_at).encode()).hexdigest()
    etag_header = f'"{etag}"'

    # Check If-None-Match header
    if_none_match = request.headers.get("If-None-Match")
    if if_none_match == etag_header:
        # Return 304 Not Modified
        return Response(status_code=304, headers={"ETag": etag_header})

    # ... существующий код ...

    # В конце функции добавить ETag в response
    response.headers["ETag"] = etag_header
    response.headers["Cache-Control"] = "private, must-revalidate"

    return response
```

**Estimate:** 2 часа

**Acceptance Criteria:**
- [ ] ETag генерируется на основе book.updated_at
- [ ] If-None-Match header обрабатывается
- [ ] 304 Not Modified возвращается корректно
- [ ] Тесты покрывают ETag logic

---

## 🧪 Тестирование

После каждой задачи запускать:

```bash
# Unit tests
cd backend
pytest tests/test_cache.py -v
pytest tests/test_books_crud.py -v
pytest tests/test_security_headers.py -v

# Integration tests
pytest tests/integration/test_cache_invalidation.py -v

# Load tests (для Task 4)
locust -f tests/load/test_cache_stampede.py --host=http://localhost:8000
```

---

## 📝 Документация

После всех изменений обновить:

- [ ] `/docs/reference/api/cache-strategy.md` - новые cache key patterns
- [ ] `/docs/reference/api/endpoints.md` - DELETE endpoint
- [ ] `/docs/guides/performance/caching.md` - cache stampede protection
- [ ] `/backend/app/core/cache.py` - CACHE_KEY_PATTERNS docstring

---

## ✅ Final Checklist

Перед деплоем:

- [ ] Все P0 задачи выполнены
- [ ] Все тесты проходят (unit + integration)
- [ ] Performance тесты пройдены (если Task 4)
- [ ] Документация обновлена
- [ ] Code review пройден
- [ ] Нет breaking changes для frontend
- [ ] Redis cache очищен на production после деплоя

---

**Estimate Total:**
- P0: 1-2 часа
- P1: 3-4 часа
- P2: 5-6 часов (optional)

**Total: 4-6 часов обязательных изменений**
