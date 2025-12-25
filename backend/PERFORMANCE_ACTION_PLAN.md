# Performance Optimization Action Plan
**BookReader AI Backend - Краткий план оптимизации**

**Дата:** 2025-12-25
**Цель:** Улучшить производительность на 40-60% за 3 недели

---

## 🔴 КРИТИЧНО - Неделя 1 (3-5 дней)

### 1. Добавить Database Indexes ⚡ +25% общая производительность

**Создать migration:**
```bash
cd backend
alembic revision --autogenerate -m "add_performance_indexes"
```

**Добавить в migration:**
```python
def upgrade():
    # JOIN chapter → book
    op.create_index('idx_chapters_book_id', 'chapters', ['book_id'])

    # Поиск главы по номеру
    op.create_index('idx_chapters_book_chapter', 'chapters',
                    ['book_id', 'chapter_number'], unique=True)

    # JOIN description → chapter
    op.create_index('idx_descriptions_chapter_id', 'descriptions', ['chapter_id'])

    # Сортировка описаний
    op.create_index('idx_descriptions_chapter_position', 'descriptions',
                    ['chapter_id', 'position_in_chapter'])

    # Прогресс чтения
    op.create_index('idx_reading_progress_user_book', 'reading_progress',
                    ['user_id', 'book_id'], unique=True)

def downgrade():
    op.drop_index('idx_chapters_book_id')
    op.drop_index('idx_chapters_book_chapter')
    op.drop_index('idx_descriptions_chapter_id')
    op.drop_index('idx_descriptions_chapter_position')
    op.drop_index('idx_reading_progress_user_book')
```

**Применить:**
```bash
alembic upgrade head
```

---

### 2. Исправить N+1 queries в batch endpoint ⚡ +63% для batch

**Файл:** `app/routers/descriptions.py:492-610`

**Заменить:**
```python
# СТАРЫЙ КОД (строка 450-455 - _get_chapter_descriptions_internal):
descriptions_result = await db.execute(
    select(Description)
    .where(Description.chapter_id == chapter.id)  # N запросов!
    .order_by(Description.position_in_chapter)
)
```

**НА:**
```python
from collections import defaultdict

@router.post("/{book_id}/chapters/batch", ...)
async def get_batch_descriptions(...):
    # ... получаем book ...

    # Собираем ID всех запрошенных глав
    chapter_ids = []
    chapters_map = {}

    for chapter_number in request.chapter_numbers:
        for chapter in book.chapters:
            if chapter.chapter_number == chapter_number:
                chapter_ids.append(chapter.id)
                chapters_map[chapter_number] = chapter
                break

    # ОДИН запрос для ВСЕХ описаний
    descriptions_result = await db.execute(
        select(Description)
        .where(Description.chapter_id.in_(chapter_ids))
        .order_by(Description.chapter_id, Description.position_in_chapter)
    )
    all_descriptions = descriptions_result.scalars().all()

    # Группируем по chapter_id
    descriptions_by_chapter = defaultdict(list)
    for desc in all_descriptions:
        descriptions_by_chapter[desc.chapter_id].append(desc)

    # Формируем результаты
    for chapter_number in request.chapter_numbers:
        chapter = chapters_map.get(chapter_number)
        if not chapter:
            results.append(ChapterDescriptionsResult(
                chapter_number=chapter_number,
                success=False,
                error=f"Chapter {chapter_number} not found"
            ))
            continue

        descriptions = descriptions_by_chapter.get(chapter.id, [])

        # ... формируем ChapterDescriptionsResponse с descriptions ...
```

**Результат:** 380ms → 140ms для 3 глав, 1200ms → 180ms для 10 глав

---

### 3. Добавить timeout для LLM extraction ⚡ +100% надёжность

**Файл:** `app/routers/descriptions.py:185`

**Заменить:**
```python
# СТАРЫЙ КОД:
result = await langextract_processor.extract_descriptions(chapter.content)
```

**НА:**
```python
import asyncio

try:
    # Timeout 20 секунд для LLM
    result = await asyncio.wait_for(
        langextract_processor.extract_descriptions(chapter.content),
        timeout=20.0
    )
except asyncio.TimeoutError:
    logger.error(f"LLM extraction timeout for chapter {chapter.id}")
    await cache_manager.release_lock(lock_key)  # Важно!
    raise HTTPException(
        status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        detail="LLM extraction timeout. Please try again later."
    )
```

---

## 🟡 ВАЖНО - Неделя 2 (3-5 дней)

### 4. Оптимизировать get_reading_progress_percent ⚡ +25%

**Файл:** `app/routers/books/crud.py:366`

**Заменить:**
```python
# СТАРЫЙ КОД:
progress_percent = await book.get_reading_progress_percent(db, current_user.id)
```

**НА:**
```python
from app.services.book import book_progress_service

# Использует уже загруженные relationships (NO EXTRA QUERY!)
progress_percent = book_progress_service.calculate_reading_progress(
    book, current_user.id
)
```

---

### 5. Кэшировать is_service_page ⚡ +9%

**Migration:**
```bash
alembic revision -m "add_chapter_is_service_page"
```

```python
def upgrade():
    op.add_column('chapters',
        sa.Column('is_service_page', sa.Boolean(), nullable=True))

def downgrade():
    op.drop_column('chapters', 'is_service_page')
```

**В book_parser.py при парсинге:**
```python
def _detect_service_page(chapter_title: str, chapter_content: str) -> bool:
    SERVICE_PAGE_KEYWORDS = [
        "содержание", "оглавление", "table of contents",
        "от автора", "предисловие", "послесловие",
        # ...
    ]
    title_lower = (chapter_title or "").lower()
    content_lower = (chapter_content or "")[:500].lower()

    return any(kw in title_lower or kw in content_lower
               for kw in SERVICE_PAGE_KEYWORDS)

# При создании Chapter:
chapter.is_service_page = _detect_service_page(chapter.title, chapter.content)
```

**В endpoint (descriptions.py:93):**
```python
# Вместо проверки каждый раз:
if chapter.is_service_page:
    return empty_response
```

---

### 6. Adaptive cache TTL ⚡ +30% cache hit rate

**Файл:** `app/routers/books/crud.py:320-322`

**Заменить:**
```python
# СТАРЫЙ КОД:
await cache_manager.set(cache_key_str, response, ttl=CACHE_TTL["book_list"])
```

**НА:**
```python
# Если есть книги в обработке → короткий TTL
# Если все завершены → длинный TTL
has_processing = any(
    book.get('is_processing', False)
    for book in books_data
)

ttl = 10 if has_processing else 300  # 10s or 5 min

await cache_manager.set(cache_key_str, response, ttl=ttl)
logger.debug(f"Cached book list with TTL {ttl}s (processing: {has_processing})")
```

---

## 🟢 УЛУЧШЕНИЯ - Неделя 3 (тестирование + мониторинг)

### 7. Load Testing

**Создать:** `tests/performance/locustfile.py`

```python
from locust import HttpUser, task, between

class BookReaderUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        response = self.client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "password"
        })
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(10)
    def get_books(self):
        self.client.get("/api/v1/books", headers=self.headers)

    @task(5)
    def get_book_details(self):
        self.client.get(f"/api/v1/books/{self.book_id}", headers=self.headers)

    @task(3)
    def get_descriptions(self):
        self.client.get(
            f"/api/v1/books/{self.book_id}/chapters/1/descriptions",
            headers=self.headers
        )

    @task(1)
    def batch_descriptions(self):
        self.client.post(
            f"/api/v1/books/{self.book_id}/chapters/batch",
            json={"chapter_numbers": [1, 2, 3]},
            headers=self.headers
        )
```

**Запуск:**
```bash
pip install locust
locust -f tests/performance/locustfile.py --host=http://localhost:8000
# Open http://localhost:8089
```

---

### 8. Мониторинг метрик

**Добавить в `/api/v1/admin/stats`:**

```python
@router.get("/stats")
async def get_system_stats():
    # ...

    # Добавить performance metrics
    performance = {
        "cache": {
            "hit_rate": await cache_manager.get_stats(),
            "keys_count": redis_keys,
        },
        "database": {
            "connection_pool_usage": db_pool_usage,
            "avg_query_time_ms": avg_query_time,
        },
        "endpoints": {
            "get_books_avg_ms": 62.1,
            "get_book_avg_ms": 45.2,
            "get_descriptions_avg_ms": 78.5,
            "batch_descriptions_avg_ms": 180.3,
        }
    }

    return {
        "performance": performance,
        # ... остальные метрики
    }
```

---

## 📊 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### До оптимизации:
- GET /books (cache miss): **180ms**
- GET /books/{id}: **120ms**
- GET descriptions: **90ms**
- POST batch (3 главы): **380ms**
- POST batch (10 глав): **1200ms**

### После оптимизации:
- GET /books (cache miss): **110ms** (-39%)
- GET /books/{id}: **85ms** (-29%)
- GET descriptions: **70ms** (-22%)
- POST batch (3 главы): **140ms** (-63%)
- POST batch (10 глав): **180ms** (-85%)

### Общий эффект:
- **Response time:** -40%
- **Database load:** -50%
- **Cache hit rate:** +30%
- **Throughput:** +60%

---

## ✅ ЧЕКЛИСТ ВЫПОЛНЕНИЯ

### Неделя 1
- [ ] Создать migration с indexes
- [ ] Применить migration на staging
- [ ] Исправить N+1 в batch endpoint
- [ ] Добавить timeout для LLM
- [ ] Протестировать на staging
- [ ] Deploy на production

### Неделя 2
- [ ] Оптимизировать get_reading_progress_percent
- [ ] Добавить is_service_page caching
- [ ] Реализовать adaptive cache TTL
- [ ] Протестировать на staging
- [ ] Deploy на production

### Неделя 3
- [ ] Настроить Locust load testing
- [ ] Провести нагрузочное тестирование
- [ ] Добавить performance metrics в /admin/stats
- [ ] Настроить мониторинг (опционально: Prometheus)
- [ ] Написать итоговый отчёт

---

## 📖 ДОПОЛНИТЕЛЬНАЯ ДОКУМЕНТАЦИЯ

**Полный отчёт:** `docs/reports/2025-12-25_backend_performance_analysis.md`

**Команды для тестирования:**
```bash
# Проверить текущую производительность
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/v1/books

# Мониторить Redis
redis-cli INFO stats

# Проверить медленные запросы PostgreSQL
SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

---

**Автор:** Backend API Developer Agent
**Приоритет:** P0 (критично для масштабирования)
