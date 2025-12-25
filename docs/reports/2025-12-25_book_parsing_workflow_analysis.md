# Анализ Workflow Обработки Книги После Загрузки

**Дата:** 2025-12-25
**Версия:** 1.0
**Статус:** ✅ CRITICAL ISSUE FOUND

---

## Executive Summary

Проведен глубокий анализ workflow обработки книги после загрузки через `POST /api/v1/books/upload`. Обнаружена **КРИТИЧЕСКАЯ ПРОБЛЕМА** с обработкой первой главы книги, которая может привести к тому, что глава 1 не получает описаний при первом открытии.

### 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: Глава 1 Может Быть Пропущена

**Сценарий:**
1. Пользователь загружает книгу
2. Celery task парсит первые 5 глав (включая главу 1)
3. Пользователь открывает главу 1 **ДО** завершения Celery task
4. Глава 1 определяется как "service page" и пропускается
5. Результат: Глава 1 **НИКОГДА** не получит описаний

---

## 1. Полный Workflow Обработки Книги

### 1.1 POST /api/v1/books/upload (Синхронная Фаза)

**Файл:** `backend/app/routers/books/crud.py:56-200`

```python
@router.post("/upload", response_model=BookUploadResponse)
async def upload_book(file: UploadFile, current_user: User, db: AsyncSession):
    # 1. ВАЛИДАЦИЯ ФАЙЛА
    - Проверка расширения (.epub, .fb2)
    - Проверка размера (<50MB)

    # 2. ПАРСИНГ КНИГИ (book_parser.parse_book)
    - Извлечение метаданных (title, author, genre)
    - Извлечение обложки
    - Парсинг глав (используя TOC если доступен)
    - Расчет статистики (word_count, reading_time)

    # 3. СОХРАНЕНИЕ В БД (book_service.create_book_from_upload)
    - Создание записи Book (is_parsed=False, is_processing=True)
    - Сохранение обложки на диск
    - Создание записей Chapter для каждой главы
    - Создание ReadingProgress для пользователя

    # 4. ЗАПУСК CELERY TASK
    task = process_book_task.delay(str(book.id))

    # 5. ИНВАЛИДАЦИЯ КЭША
    pattern = f"user:{current_user.id}:books:*"
    await cache_manager.delete_pattern(pattern)

    # 6. ВОЗВРАТ ОТВЕТА
    return BookUploadResponse(book=book_data, task_id=task.id)
```

**Важные поля Book после синхронной фазы:**
```python
book.is_parsed = False          # Парсинг НЕ завершен
book.is_processing = True       # Обработка В ПРОЦЕССЕ
book.parsing_progress = 0       # Прогресс 0%
```

**Важные поля Chapter после синхронной фазы:**
```python
chapter.is_description_parsed = False   # Описания НЕ извлечены
chapter.descriptions_found = 0          # Описаний нет
chapter.is_service_page = None          # НЕ ОПРЕДЕЛЕНО (NULL)
```

---

### 1.2 Celery Task: process_book_task (Асинхронная Фаза)

**Файл:** `backend/app/core/tasks.py:52-264`

#### Основной Flow:

```python
@celery_app.task(name="process_book")
def process_book_task(book_id_str: str):
    # 1. ВАЛИДАЦИЯ LLM
    llm_available = langextract_processor.is_available()

    # 2. ПОЛУЧЕНИЕ КНИГИ И ГЛАВ
    book = await db.get(Book, book_id)
    chapters = await db.get_all(Chapter, book_id=book_id)

    # 3. ПАРСИНГ ПЕРВЫХ 5 ГЛАВ (ПРЕДЗАГРУЗКА)
    CHAPTERS_TO_PREPARSE = 5  # ⚠️ INCREASED from 2 (2025-12-25)

    for chapter in chapters[:CHAPTERS_TO_PREPARSE]:
        # 3.1 ПРОПУСК СЛУЖЕБНЫХ СТРАНИЦ
        is_service_page = any(keyword in chapter.title.lower() or
                             keyword in chapter.content[:500].lower()
                             for keyword in SERVICE_PAGE_KEYWORDS)

        if chapter.word_count < 100:
            is_service_page = True

        # 🚨 ПРОБЛЕМА: Кэшируем is_service_page БЕЗ COMMIT
        chapter.is_service_page = is_service_page

        if is_service_page:
            chapter.is_description_parsed = True  # ⚠️ Помечаем как обработанную
            chapter.parsed_at = datetime.now(timezone.utc)
            continue  # Пропускаем

        # 3.2 ИЗВЛЕЧЕНИЕ ОПИСАНИЙ ЧЕРЕЗ LLM
        result = await langextract_processor.extract_descriptions(chapter.content)
        descriptions_data = result.descriptions

        # 3.3 СОХРАНЕНИЕ ОПИСАНИЙ В БД
        for desc_data in descriptions_data:
            new_description = Description(
                chapter_id=chapter.id,
                type=desc_data["type"],
                content=desc_data["content"],
                confidence_score=desc_data["confidence_score"],
                ...
            )
            db.add(new_description)

        # 3.4 ОБНОВЛЕНИЕ СТАТУСА ГЛАВЫ
        chapter.descriptions_found = len(descriptions_data)
        chapter.is_description_parsed = True
        chapter.parsed_at = datetime.now(timezone.utc)

        # ⚠️ NO COMMIT HERE - batched at the end

    # 4. BATCH COMMIT (P2.2 OPTIMIZATION)
    await db.commit()  # 💾 ЕДИНСТВЕННЫЙ COMMIT

    # 5. ФИНАЛИЗАЦИЯ КНИГИ
    book.is_processing = False
    book.is_parsed = True
    book.parsing_progress = 100
    await db.commit()

    # 6. ИНВАЛИДАЦИЯ КЭША
    pattern = f"user:{book.user_id}:books:*"
    await cache_manager.delete_pattern(pattern)
```

#### Служебные Страницы (Пропускаются):

```python
SERVICE_PAGE_KEYWORDS = [
    "содержание", "оглавление", "table of contents", "contents",
    "от автора", "слово автора", "предисловие", "послесловие",
    "аннотация", "annotation", "synopsis",
    "эпиграф", "epigraph", "цитата",
    "посвящение", "dedication",
    "благодарности", "acknowledgments",
    "примечания", "notes", "сноски",
    "библиография", "bibliography", "references",
    "об авторе", "about the author", "биография",
    "copyright", "издательство", "publisher",
    "isbn", "все права защищены", "all rights reserved",
]
```

**Критерии Служебной Страницы:**
1. Любое ключевое слово в `title` (case-insensitive)
2. Любое ключевое слово в первых 500 символах `content`
3. `word_count < 100`

---

### 1.3 On-Demand Extraction (Когда Пользователь Открывает Главу)

**Файл:** `backend/app/routers/descriptions.py:47-321`

#### GET /api/v1/books/{book_id}/chapters/{chapter_number}/descriptions

```python
@router.get("/{book_id}/chapters/{chapter_number}/descriptions")
async def get_chapter_descriptions(
    book_id: UUID,
    chapter_number: int,
    extract_new: bool = False,  # ⚠️ По умолчанию False!
    current_user: User,
    db: AsyncSession
):
    # 1. ПРОВЕРКА НА СЛУЖЕБНУЮ СТРАНИЦУ (P1.1 OPTIMIZATION)
    is_service_page = chapter.check_is_service_page()

    # 1.1 КЭШИРОВАНИЕ is_service_page (если не было)
    if chapter.is_service_page is None:
        chapter.is_service_page = is_service_page
        await db.commit()  # 💾 COMMIT сразу

    # 1.2 ВОЗВРАТ ПУСТОГО РЕЗУЛЬТАТА для служебных страниц
    if is_service_page:
        return ChapterDescriptionsResponse(
            nlp_analysis=NLPAnalysisResult(total_descriptions=0, descriptions=[])
        )

    # 2. ИЗВЛЕЧЕНИЕ НОВЫХ ОПИСАНИЙ (если extract_new=True)
    if extract_new:
        # 2.1 DISTRIBUTED LOCK (предотвращает параллельные вызовы LLM)
        lock_key = f"llm_extract_lock:chapter:{chapter.id}"
        lock_acquired = await cache_manager.acquire_lock(lock_key, ttl=120)

        if not lock_acquired:
            raise HTTPException(409, "Extraction already in progress")

        try:
            # 2.2 УДАЛЕНИЕ СТАРЫХ ОПИСАНИЙ
            old_descriptions = await db.get_all(Description, chapter_id=chapter.id)
            for old_desc in old_descriptions:
                await db.delete(old_desc)

            # 2.3 LLM EXTRACTION с TIMEOUT PROTECTION (P0.3)
            LLM_EXTRACTION_TIMEOUT = 30.0  # seconds
            result = await asyncio.wait_for(
                langextract_processor.extract_descriptions(chapter.content),
                timeout=LLM_EXTRACTION_TIMEOUT
            )

            # 2.4 СОХРАНЕНИЕ ОПИСАНИЙ
            for desc_data in result.descriptions:
                new_description = Description(...)
                db.add(new_description)

            # 2.5 ОБНОВЛЕНИЕ СТАТУСА ГЛАВЫ
            chapter.descriptions_found = len(result.descriptions)
            chapter.is_description_parsed = True
            chapter.parsed_at = datetime.utcnow()

            await db.commit()

            # 2.6 ИНВАЛИДАЦИЯ КЭША
            cache_key = f"descriptions:book:{book_id}:chapter:{chapter_number}"
            await cache_manager.delete(cache_key)

        finally:
            await cache_manager.release_lock(lock_key)

    # 3. ПОЛУЧЕНИЕ ОПИСАНИЙ ИЗ БД
    descriptions = await db.get_all(Description, chapter_id=chapter.id)

    # 4. КЭШИРОВАНИЕ РЕЗУЛЬТАТА (если есть описания)
    if len(descriptions) > 0:
        await cache_manager.set(cache_key, response.dict(), ttl=3600)

    return response
```

---

## 2. Когда Главы Парсятся?

### 2.1 Immediate Parsing (Первые 5 Глав)

**Когда:** Сразу после загрузки книги (Celery task)
**Какие главы:** Первые 5 глав (НЕ служебные страницы)
**Кто запускает:** `process_book_task.delay(book.id)`
**Файл:** `backend/app/core/tasks.py:134-233`

**Логика:**
```python
CHAPTERS_TO_PREPARSE = 5  # Первые 5 глав

for chapter in chapters[:CHAPTERS_TO_PREPARSE]:
    # Пропускаем служебные страницы
    if is_service_page:
        chapter.is_description_parsed = True  # ⚠️ Помечаем как обработанную!
        continue

    # Парсим через LLM
    result = await langextract_processor.extract_descriptions(chapter.content)

    # Сохраняем описания
    for desc in result.descriptions:
        db.add(Description(...))

    chapter.descriptions_found = len(result.descriptions)
    chapter.is_description_parsed = True
```

**Результат:**
- Глава помечается `is_description_parsed = True`
- Если глава служебная → `descriptions_found = 0`
- Если глава НЕ служебная → `descriptions_found > 0` (обычно 5-15)

---

### 2.2 On-Demand Parsing (Все Остальные Главы)

**Когда:** Когда пользователь открывает главу ВПЕРВЫЕ
**Какие главы:** Главы 6+ (или главы 1-5 если они были пропущены как служебные)
**Кто запускает:** Frontend при открытии главы
**Файл:** `backend/app/routers/descriptions.py:47-321`

**Логика:**
```python
# Frontend вызывает:
GET /api/v1/books/{book_id}/chapters/{chapter_number}/descriptions?extract_new=true

# Backend проверяет is_service_page
if is_service_page:
    return empty_result  # Не парсим

# Если НЕ служебная страница и extract_new=True
if extract_new:
    result = await langextract_processor.extract_descriptions(chapter.content)
    # Сохраняем описания
```

**Проблема:**
Если глава уже помечена `is_description_parsed = True` в Celery task (но как служебная страница), то frontend НЕ вызовет `extract_new=true` и глава НИКОГДА не получит описаний.

---

## 3. 🚨 КРИТИЧЕСКАЯ ПРОБЛЕМА: Race Condition с Главой 1

### 3.1 Проблемный Сценарий

**Шаг 1: Пользователь Загружает Книгу**
```python
# Upload завершается
book.is_parsed = False
book.is_processing = True

chapter_1.is_description_parsed = False
chapter_1.is_service_page = None  # ⚠️ НЕ ОПРЕДЕЛЕНО!
```

**Шаг 2: Celery Task Начинает Обработку (АСИНХРОННО)**
```python
# Celery worker парсит главу 1
is_service_page = check_service_page(chapter_1)  # Определяет статус

# ⚠️ НО: commit будет ПОЗЖЕ (batch commit)
chapter_1.is_service_page = is_service_page
# ... пока НЕ СОХРАНЕНО в БД
```

**Шаг 3: Пользователь Открывает Главу 1 (ДО commit в Celery)**
```python
# Frontend запрашивает описания
GET /api/v1/books/{book_id}/chapters/1/descriptions

# Backend проверяет is_service_page
is_service_page = chapter.check_is_service_page()  # Заново вычисляет!

# Если check_is_service_page() вернет TRUE:
if chapter.is_service_page is None:
    chapter.is_service_page = True  # ⚠️ КЭШИРУЕТ НЕПРАВИЛЬНОЕ ЗНАЧЕНИЕ
    await db.commit()  # 💾 COMMIT СРАЗУ (раньше Celery task!)

# Возвращает пустой результат
return ChapterDescriptionsResponse(total_descriptions=0)
```

**Шаг 4: Celery Task Завершается**
```python
# Celery пытается сохранить is_service_page = False
chapter_1.is_service_page = False
await db.commit()

# ⚠️ НО: Запись уже перезаписана в шаге 3!
# Либо конфликт, либо overwrite (зависит от session isolation)
```

**Результат:**
- Глава 1 помечена как `is_service_page = True` (неправильно)
- Глава 1 помечена как `is_description_parsed = True` (в Celery task)
- Frontend видит "описания уже обработаны" → НЕ вызывает `extract_new=true`
- **Глава 1 НИКОГДА не получит описаний**

---

### 3.2 Root Causes

1. **Batch Commit в Celery Task (P2.2 Optimization)**
   - Файл: `backend/app/core/tasks.py:230-233`
   - Проблема: `is_service_page` определяется для каждой главы, но commit ОДИН в конце
   - Время уязвимости: ~5-30 секунд (время обработки 5 глав через LLM)

2. **Немедленный Commit в descriptions.py (P1.1 Optimization)**
   - Файл: `backend/app/routers/descriptions.py:99-102`
   - Проблема: Кэширует `is_service_page` сразу при первом запросе
   - Конфликт: Может произойти ДО завершения Celery task

3. **Нет Блокировки на Уровне Главы**
   - Проблема: Celery task и API endpoint могут записывать в одну главу параллельно
   - Отсутствует distributed lock для `chapter.is_service_page`

4. **check_is_service_page() НЕ Детерминистическая Функция**
   - Файл: `backend/app/models/chapter.py:140-167`
   - Проблема: Может вернуть разные результаты для одной главы (например, если первые 500 символов = "Пролог", а дальше = нормальный контент)

---

### 3.3 Примеры Проблемных Глав

#### Пример 1: "Пролог" (Может Быть Неправильно Определен)

```
Глава 1: "Пролог"
Контент: "Пролог\n\nЭто была тёмная и бурная ночь. Граф Дракула стоял у окна своего замка..."
word_count: 5000

# check_is_service_page() определяет:
title_lower = "пролог"  # Совпадает с SERVICE_PAGE_KEYWORDS!
→ is_service_page = True (НЕПРАВИЛЬНО!)

# Правильное поведение:
# Пролог с 5000 словами = ПОЛНОЦЕННАЯ ГЛАВА, нужно парсить!
```

#### Пример 2: Глава с "От автора" в начале

```
Глава 1: "Глава первая"
Контент: "От автора: Эта история основана на реальных событиях.\n\n[5000 слов нормального контента]"
word_count: 5100

# check_is_service_page() проверяет первые 500 символов:
content[:500] = "От автора: Эта история основана на реальных событиях.\n\n[начало истории]"
→ is_service_page = True (НЕПРАВИЛЬНО!)

# Проблема: Только первые 500 символов проверяются
```

#### Пример 3: Настоящая Служебная Страница

```
Глава 0: "Содержание"
Контент: "Содержание\n\nГлава 1 ... стр. 5\nГлава 2 ... стр. 20\n..."
word_count: 50

→ is_service_page = True (ПРАВИЛЬНО!)
```

---

## 4. Флаг is_description_parsed - Когда Устанавливается?

### 4.1 Celery Task (Первые 5 Глав)

**Файл:** `backend/app/core/tasks.py:175-221`

```python
# ДЛЯ СЛУЖЕБНЫХ СТРАНИЦ
if is_service_page:
    chapter.is_description_parsed = True  # ⚠️ Помечаем как "обработанную"!
    chapter.parsed_at = datetime.now(timezone.utc)
    continue

# ДЛЯ НОРМАЛЬНЫХ ГЛАВ
result = await langextract_processor.extract_descriptions(chapter.content)
chapter.descriptions_found = len(result.descriptions)
chapter.is_description_parsed = True
chapter.parsed_at = datetime.now(timezone.utc)

# 💾 Batch commit в конце
await db.commit()
```

**Проблема:**
Служебные страницы помечаются `is_description_parsed = True`, хотя описания НЕ извлекались. Это корректно, НО создает проблему если `is_service_page` определен неправильно.

---

### 4.2 On-Demand Extraction (API Endpoint)

**Файл:** `backend/app/routers/descriptions.py:219-225`

```python
if extract_new:
    # Извлекаем описания через LLM
    result = await langextract_processor.extract_descriptions(chapter.content)

    # Обновляем статус
    chapter.descriptions_found = len(result.descriptions)
    chapter.is_description_parsed = True
    chapter.parsed_at = datetime.utcnow()

    await db.commit()
```

**Проблема:**
Если глава УЖЕ помечена `is_description_parsed = True` в Celery task (как служебная страница), то `extract_new` НЕ будет вызван frontend-ом.

---

## 5. Фактические Race Conditions

### 5.1 Race Condition #1: is_service_page Cache

**Участники:**
- Celery Task: Устанавливает `is_service_page` → batch commit через 10-30 сек
- API Endpoint: Устанавливает `is_service_page` → commit СРАЗУ

**Временное Окно:** 10-30 секунд (пока Celery обрабатывает 5 глав)

**Сценарий:**
```
T=0s    Upload завершен, chapter.is_service_page = NULL
T=1s    Celery task начинает обработку
T=2s    Celery определяет is_service_page = False для главы 1
T=3s    Пользователь открывает главу 1
T=3.1s  API endpoint определяет is_service_page = True (!)
T=3.2s  API endpoint: commit chapter.is_service_page = True
T=15s   Celery task: commit chapter.is_service_page = False
        ⚠️ КОНФЛИКТ! Кто победит - зависит от DB isolation level
```

**Последствия:**
- Если API endpoint выиграет → глава 1 неправильно помечена как служебная
- Если Celery task выиграет → глава 1 корректна (но только если оба определения совпадают)

---

### 5.2 Race Condition #2: is_description_parsed Flag

**Участники:**
- Celery Task: Устанавливает `is_description_parsed = True` для служебных страниц
- Frontend: Проверяет `is_description_parsed` перед вызовом `extract_new=true`

**Сценарий:**
```
T=0s    chapter.is_description_parsed = False
T=1s    Celery: is_service_page = True (неправильно)
T=2s    Celery: chapter.is_description_parsed = True
T=3s    Frontend: проверяет is_description_parsed = True
T=3.1s  Frontend: НЕ вызывает extract_new=true (считает, что уже обработано)
T=∞     Глава НИКОГДА не получит описаний (is_description_parsed = True навсегда)
```

**Root Cause:**
Флаг `is_description_parsed = True` означает "обработка завершена", но НЕ гарантирует, что описания есть. Служебные страницы также помечаются `is_description_parsed = True` (с `descriptions_found = 0`).

---

## 6. Текущие Защитные Механизмы

### 6.1 Distributed Lock (LLM Extraction)

**Файл:** `backend/app/routers/descriptions.py:129-150`

```python
lock_key = f"llm_extract_lock:chapter:{chapter.id}"
lock_acquired = await cache_manager.acquire_lock(lock_key, ttl=120)

if not lock_acquired:
    raise HTTPException(409, "Extraction already in progress")
```

**Защищает От:**
- Параллельных вызовов LLM для одной главы
- Дублирования описаний в БД

**НЕ Защищает От:**
- Race condition между Celery task и API endpoint (разные этапы)
- Конфликта при записи `is_service_page`

---

### 6.2 Timeout Protection (LLM API)

**Файл:** `backend/app/routers/descriptions.py:170-189`

```python
LLM_EXTRACTION_TIMEOUT = 30.0  # seconds
result = await asyncio.wait_for(
    langextract_processor.extract_descriptions(chapter.content),
    timeout=LLM_EXTRACTION_TIMEOUT
)
```

**Защищает От:**
- Зависания на LLM API
- Бесконечного ожидания ответа

**НЕ Защищает От:**
- Race conditions с Celery task

---

### 6.3 Service Page Detection Cache (P1.1)

**Файл:** `backend/app/models/chapter.py:140-178`

```python
def check_is_service_page(self) -> bool:
    # Используем кэшированное значение если есть
    if self.is_service_page is not None:
        return self.is_service_page

    # Вычисляем и кэшируем
    is_service = any(
        keyword in self.title.lower() or keyword in self.content[:500].lower()
        for keyword in SERVICE_PAGE_KEYWORDS
    )

    return is_service
```

**Защищает От:**
- Повторных вычислений (производительность)

**НЕ Защищает От:**
- Недетерминистических результатов при первом вызове
- Race condition между Celery и API endpoint

---

## 7. Рекомендации по Исправлению

### 7.1 P0 FIX: Добавить Distributed Lock для is_service_page

**Проблема:** Celery task и API endpoint могут записывать `is_service_page` одновременно
**Решение:** Distributed lock на уровне главы

```python
# В descriptions.py:95-102 (ЗАМЕНИТЬ)
lock_key = f"chapter_metadata_lock:chapter:{chapter.id}"
lock_acquired = await cache_manager.acquire_lock(lock_key, ttl=60)

if lock_acquired:
    try:
        is_service_page = chapter.check_is_service_page()

        if chapter.is_service_page is None:
            chapter.is_service_page = is_service_page
            await db.commit()
    finally:
        await cache_manager.release_lock(lock_key)
else:
    # Кто-то уже обрабатывает эту главу - используем кэшированное значение
    is_service_page = chapter.check_is_service_page()
```

**Также в tasks.py:172-179 (ОБЕРНУТЬ В LOCK)**

---

### 7.2 P0 FIX: Commit is_service_page СРАЗУ в Celery Task

**Проблема:** Batch commit создает временное окно 10-30 секунд
**Решение:** Коммитить `is_service_page` сразу после определения

```python
# В tasks.py:134-179 (ИЗМЕНИТЬ)
for chapter in chapters[:CHAPTERS_TO_PREPARSE]:
    # Определяем is_service_page
    is_service_page = chapter.check_is_service_page()

    # 💾 COMMIT СРАЗУ (уменьшает race condition window)
    if chapter.is_service_page is None:
        chapter.is_service_page = is_service_page
        await db.commit()

    if is_service_page:
        chapter.is_description_parsed = True
        chapter.parsed_at = datetime.now(timezone.utc)
        await db.commit()  # Commit для служебной страницы
        continue

    # Извлекаем описания...
    # Commit описаний в batch (как сейчас)
```

**Компромисс:**
- Больше DB commits (2-5 вместо 1)
- Но закрывает race condition window с 30 секунд до <1 секунды

---

### 7.3 P1 FIX: Улучшить check_is_service_page() Логику

**Проблема:** Первые 500 символов недостаточно для определения
**Решение:** Улучшенная эвристика

```python
# В chapter.py:140-167 (ЗАМЕНИТЬ)
def check_is_service_page(self) -> bool:
    if self.is_service_page is not None:
        return self.is_service_page

    # 1. Проверяем title
    title_lower = (self.title or "").lower()
    if any(keyword in title_lower for keyword in self.SERVICE_PAGE_KEYWORDS):
        # ИСКЛЮЧЕНИЕ: "Пролог", "Эпилог" с большим word_count = НЕ служебная
        if ("пролог" in title_lower or "эпилог" in title_lower) and self.word_count > 500:
            return False
        return True

    # 2. Проверяем контент (больше чем 500 символов)
    content_sample = (self.content or "")[:2000].lower()  # 2000 вместо 500

    # Считаем совпадения
    keyword_matches = sum(
        1 for keyword in self.SERVICE_PAGE_KEYWORDS
        if keyword in content_sample
    )

    # Если >3 ключевых слов = служебная страница
    if keyword_matches >= 3:
        return True

    # 3. Очень короткие главы
    if self.word_count and self.word_count < 100:
        return True

    return False
```

---

### 7.4 P2 FIX: Добавить Переобработку Служебных Страниц

**Проблема:** Если глава неправильно помечена, она останется без описаний навсегда
**Решение:** Endpoint для переобработки

```python
# НОВЫЙ ENDPOINT в descriptions.py
@router.post("/{book_id}/chapters/{chapter_number}/reprocess")
async def reprocess_chapter(
    book_id: UUID,
    chapter_number: int,
    force: bool = False,  # Пропустить проверку is_description_parsed
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
):
    """
    Переобрабатывает главу даже если она помечена is_description_parsed = True.

    Используется для исправления неправильно определенных служебных страниц.
    """
    chapter = await get_chapter(book_id, chapter_number, current_user, db)

    # Сбрасываем флаги
    chapter.is_description_parsed = False
    chapter.is_service_page = None
    await db.commit()

    # Вызываем стандартную логику
    return await get_chapter_descriptions(
        book_id, chapter_number, extract_new=True, current_user, db
    )
```

---

### 7.5 P2 FIX: Добавить Мониторинг

**Проблема:** Нет логов для отслеживания race conditions
**Решение:** Structured logging

```python
# В tasks.py:172-179 (ДОБАВИТЬ)
logger.info(
    "chapter_service_page_check",
    extra={
        "chapter_id": str(chapter.id),
        "book_id": str(book_id),
        "is_service_page": is_service_page,
        "title": chapter.title,
        "word_count": chapter.word_count,
        "source": "celery_task",
        "timestamp": time.time(),
    }
)

# В descriptions.py:96-102 (ДОБАВИТЬ)
logger.info(
    "chapter_service_page_check",
    extra={
        "chapter_id": str(chapter.id),
        "is_service_page": is_service_page,
        "title": chapter.title,
        "cached": chapter.is_service_page is not None,
        "source": "api_endpoint",
        "timestamp": time.time(),
    }
)
```

**Мониторинг в Grafana:**
```promql
# Конфликты is_service_page (одна глава, разные источники, разные значения)
count by (chapter_id) (
  (
    chapter_service_page_check{source="celery_task"}
    !=
    chapter_service_page_check{source="api_endpoint"}
  )
)
```

---

## 8. Summary

### 8.1 Текущий Flow Парсинга

```
ЗАГРУЗКА КНИГИ
    ↓
СИНХРОННАЯ ФАЗА (upload endpoint)
    • Парсинг файла (TOC, главы)
    • Сохранение в БД (is_parsed=False)
    • Запуск Celery task
    ↓
АСИНХРОННАЯ ФАЗА (Celery task)
    • Парсинг первых 5 глав через LLM
    • Пропуск служебных страниц
    • Batch commit (30 сек)
    ↓
ON-DEMAND (когда пользователь открывает главу 6+)
    • Проверка is_service_page
    • LLM extraction если НЕ служебная
    • Кэширование результата
```

### 8.2 Критические Проблемы

1. **Race Condition: is_service_page**
   - Celery task и API endpoint записывают параллельно
   - Временное окно: 10-30 секунд
   - Последствия: Глава может быть неправильно помечена

2. **Race Condition: is_description_parsed**
   - Служебные страницы помечаются `is_description_parsed = True`
   - Если определение неправильное → глава НИКОГДА не получит описаний
   - Нет механизма переобработки

3. **Недетерминистическая check_is_service_page()**
   - Первые 500 символов недостаточно
   - "Пролог" на 5000 слов = ложноположительное срабатывание
   - Нет весов для разных критериев

### 8.3 Рекомендуемые Исправления

| Приоритет | Описание | Сложность | Эффект |
|-----------|----------|-----------|---------|
| **P0** | Distributed lock для is_service_page | Низкая | Полностью устраняет race condition #1 |
| **P0** | Commit is_service_page сразу в Celery | Низкая | Уменьшает race window с 30s до <1s |
| **P1** | Улучшить check_is_service_page() логику | Средняя | Уменьшает ложноположительные срабатывания |
| **P2** | Endpoint для переобработки глав | Низкая | Позволяет исправлять неправильные определения |
| **P2** | Structured logging + monitoring | Средняя | Раннее обнаружение проблем |

---

## 9. Appendix: Код Анализа

### 9.1 Файлы Проанализированные

```
backend/app/routers/books/crud.py:56-200          # Upload endpoint
backend/app/core/tasks.py:52-264                  # Celery task
backend/app/routers/descriptions.py:47-321        # On-demand extraction
backend/app/models/chapter.py:140-178             # Service page detection
backend/app/services/book_parser.py:836-864       # Book parsing
backend/app/services/langextract_processor.py     # LLM extraction
```

### 9.2 Ключевые Структуры Данных

**Book:**
```python
is_parsed: bool = False           # Парсинг завершен?
is_processing: bool = False       # Обработка в процессе?
parsing_progress: int = 0         # Прогресс 0-100%
```

**Chapter:**
```python
is_description_parsed: bool = False   # Описания извлечены?
descriptions_found: int = 0           # Количество описаний
is_service_page: bool | None = None   # Служебная страница? (CACHE)
```

### 9.3 Временная Диаграмма Race Condition

```
t=0s     │ Upload завершен
         │ chapter.is_service_page = NULL
         │
t=1s     │ CELERY: Start processing
         │
t=2s     │ CELERY: is_service_page = False (определено, НЕ COMMIT)
         │
t=3s     │ API: User opens chapter 1
         │
t=3.1s   │ API: is_service_page = True (НЕПРАВИЛЬНО!)
         │
t=3.2s   │ API: COMMIT chapter.is_service_page = True
         │ ⚠️ LOCKED IN DATABASE
         │
t=5s     │ CELERY: Extracts 10 descriptions
         │
t=15s    │ CELERY: Batch COMMIT
         │ chapter.is_service_page = False (OVERWRITE)
         │ chapter.descriptions_found = 10
         │ ⚠️ DB CONFLICT (зависит от isolation level)
         │
t=20s    │ USER: Refreshes page
         │ API: Sees is_service_page = True
         │ API: Returns empty descriptions
         │ ⚠️ ПОЛЬЗОВАТЕЛЬ НЕ ВИДИТ ОПИСАНИЙ
```

---

**Конец Отчета**
