# Анализ Тестового Покрытия BookReader AI

**Дата:** 26 декабря 2025
**Аналитик:** Claude (Test Automation Engineer)
**Проект:** BookReader AI
**Версия:** December 2025 (Post-NLP Removal)

---

## Исполнительное Резюме

Проведён комплексный анализ тестового покрытия проекта BookReader AI. Проект имеет **неравномерное тестовое покрытие** с сильной стороной в интеграционных тестах backend и критическими пробелами в тестировании ключевых сервисов.

### Ключевые Выводы

| Метрика | Backend (pytest) | Frontend (Vitest) |
|---------|------------------|-------------------|
| **Файлов тестов** | 36 | 7 |
| **Строк кода** | ~13,564 | ~2,500 (оценка) |
| **Покрытие (оценка)** | 35-45% | 15-25% |
| **Статус** | Частичное | Минимальное |

**Критическая проблема:** 11 из 18 критических сервисов backend НЕ имеют тестов (~61% непокрытых).

---

## 1. Backend Тестирование (pytest)

### 1.1 Текущее Состояние

#### Структура Тестов

```
backend/tests/
├── conftest.py                      (444 строки)  - Fixtures
├── test_auth.py                     (178 строк)   - Аутентификация
├── test_books.py                    (279 строк)   - CRUD книг
├── test_book_service.py             (621 строка)  - Book service
├── test_book_parser.py              (1,128 строк) - EPUB/FB2 парсинг
├── test_user_statistics_service.py  (481 строка)  - Статистика
├── test_security.py                 (564 строки)  - Безопасность
├── routers/                         (5 файлов)    - API endpoints
├── integration/                     (4 файла)     - Интеграционные тесты
├── services/                        (3 файла)     - Сервисные тесты
├── performance/                     (1 файл)      - Нагрузочные тесты
└── schemas/                         (2 файла)     - Схемы данных
```

#### Качество Существующих Тестов

**Сильные стороны:**

1. **Отличные фикстуры** (`conftest.py`):
   - Изолированная тестовая БД (PostgreSQL)
   - Асинхронные сессии
   - Mock NLP processor и image generator
   - Authenticated user fixtures
   - Качественные sample data фикстуры

2. **Comprehensive test suite для критических модулей:**
   - `test_book_parser.py` - 1,128 строк, покрывает EPUB/FB2 парсинг
   - `test_feature_flag_manager.py` - 663 строки, 100% покрытие feature flags
   - `test_auth.py` - покрывает весь auth flow

3. **Интеграционные тесты:**
   - `test_reading_sessions_flow.py` (656 строк) - end-to-end flow
   - `test_books_router_integration.py` (461 строка)
   - `test_admin_router_integration.py` (426 строк)

4. **Performance тесты:**
   - `test_reading_sessions_load.py` - нагрузочные тесты
   - `test_jsonb_performance.py` - оптимизация JSONB
   - `test_performance_n1_fix.py` - N+1 query тесты

**Слабые стороны:**

1. **Моки устарели:**
   ```python
   # conftest.py:81-94
   @pytest.fixture
   def mock_nlp_processor():
       """Mock NLP processor for testing."""
       mock = AsyncMock()
       mock.extract_descriptions.return_value = [...]
       return mock
   ```
   **Проблема:** NLP система удалена (декабрь 2025), но моки остались.

2. **Недостаток edge case тестирования:**
   - Нет тестов для concurrent uploads
   - Отсутствуют тесты для quota limits
   - Не покрыты race conditions

3. **Слабые assertions:**
   ```python
   # test_descriptions.py:59
   if response.status_code == 200:
       data = response.json()
       assert "chapter_info" in data
   ```
   **Проблема:** Тест проходит даже если endpoint возвращает 404.

---

### 1.2 Непокрытые Критические Сервисы

| Сервис | Строк | Критичность | Тесты | Статус |
|--------|-------|-------------|-------|--------|
| **gemini_extractor.py** | 661 | КРИТИЧНО | 0 | НЕТ ТЕСТОВ |
| **imagen_generator.py** | 644 | КРИТИЧНО | 0 | НЕТ ТЕСТОВ |
| **langextract_processor.py** | 815 | КРИТИЧНО | 0 | НЕТ ТЕСТОВ |
| **llm_description_enricher.py** | 413 | КРИТИЧНО | 0 | НЕТ ТЕСТОВ |
| **image_generator.py** | 283 | КРИТИЧНО | TEMPLATE | НЕТ ТЕСТОВ |
| **reading_session_cache.py** | 454 | ВЫСОКАЯ | 0 | НЕТ ТЕСТОВ |
| **reading_session_service.py** | 379 | ВЫСОКАЯ | Partial | ЧАСТИЧНО |
| **settings_manager.py** | 422 | ВЫСОКАЯ | 0 | НЕТ ТЕСТОВ |
| **parsing_manager.py** | 319 | СРЕДНЯЯ | 0 | НЕТ ТЕСТОВ |
| **vless_http_client.py** | 255 | СРЕДНЯЯ | 0 | НЕТ ТЕСТОВ |
| **auth_service.py** | 373 | ВЫСОКАЯ | Indirect | КОСВЕННО |

**Покрытые сервисы (хорошо):**
- `book_parser.py` - 925 строк, 60-70% покрытие
- `feature_flag_manager.py` - 378 строк, ~100% покрытие
- `user_statistics_service.py` - 407 строк, ~80% покрытие
- `book/*.py` - 4 сервиса, частично покрыты

---

### 1.3 Критические Пробелы

#### 1.3.1 Отсутствие LLM/AI Тестирования

**Непокрытый код:**

```python
# gemini_extractor.py - 661 строк БЕЗ ТЕСТОВ
class GeminiExtractor:
    async def extract_descriptions(self, chapter_text: str) -> List[Description]:
        # Критичный метод - 0% покрытие
        response = await self.gemini_client.generate_content(...)
        # Нет тестов для:
        # - API errors (429, 503)
        # - Malformed responses
        # - Rate limiting
        # - Quota exceeded
        # - Токенизация
```

**Риски:**
- Отсутствие обработки API ошибок
- Неконтролируемые расходы на Gemini API
- Нет fallback стратегии
- Не протестирована Russian → English translation

#### 1.3.2 Отсутствие Image Generation Тестирования

**Непокрытый код:**

```python
# imagen_generator.py - 644 строк БЕЗ ТЕСТОВ
class ImagenGenerator:
    async def generate_image(self, description: str) -> GeneratedImage:
        # 0% покрытие критичного функционала
        response = await aiplatform.ImageGenerationModel(...).generate_images(...)
        # Нет тестов для:
        # - Moderation failures
        # - Safety filter rejections
        # - Timeout handling
        # - Quota limits ($0.04/image)
```

**Файл:** `test_image_generator_TEMPLATE.py` - 482 строки
**Статус:** TEMPLATE ONLY, не запускается

```python
# Строка 15
# TODO: Этот шаблон нужно адаптировать для реального тестирования
# после миграции на Google Imagen
```

#### 1.3.3 Отсутствие Cache Тестирования

**Непокрытый код:**

```python
# reading_session_cache.py - 454 строк БЕЗ ТЕСТОВ
class ReadingSessionCache:
    async def get(self, user_id: str, book_id: str) -> Optional[Session]:
        # Redis операции без тестов
        # Риски:
        # - Cache invalidation bugs
        # - Memory leaks
        # - Race conditions
        # - Serialization errors
```

**Критичность:** Высокая - кэш используется для всех reading sessions.

---

## 2. Frontend Тестирование (Vitest)

### 2.1 Текущее Состояние

#### Структура Тестов

```
frontend/src/
├── components/__tests__/
│   └── ErrorBoundary.test.tsx        (~100 строк)
├── components/Reader/__tests__/
│   └── EpubReader.test.tsx           (1,019 строк) - Отличное покрытие
├── pages/__tests__/
│   └── LibraryPage.test.tsx          (746 строк)   - Хорошее покрытие
├── services/__tests__/
│   └── chapterCache.test.ts          (214 строк)   - IndexedDB
├── stores/__tests__/
│   ├── auth.test.ts                  (~150 строк)
│   └── books.test.ts                 (~150 строк)
└── api/__tests__/
    └── books.test.ts                 (~100 строк)
```

**Всего:** ~2,500 строк тестового кода

#### Качество Существующих Тестов

**Сильные стороны:**

1. **EpubReader.test.tsx - ОБРАЗЦОВЫЙ ТЕСТ:**
   - 1,019 строк
   - 35 тестов, 6 категорий:
     - Component rendering (5)
     - epub.js integration (8)
     - CFI position restoration (8)
     - Progress tracking (6)
     - Description highlighting (4)
     - Navigation (4)
   - Отличные моки для всех зависимостей
   - Правильная изоляция тестов

2. **LibraryPage.test.tsx - ХОРОШЕЕ ПОКРЫТИЕ:**
   - 746 строк
   - 20 тестов, 4 категории:
     - Books list rendering (6)
     - Book upload (6)
     - Book actions (4)
     - Search & filter (4)
   - Интеграция с Zustand store
   - User event тестирование

3. **chapterCache.test.ts - КАЧЕСТВЕННЫЕ UNIT ТЕСТЫ:**
   - 214 строк
   - 10 тестов
   - IndexedDB изоляция между тестами
   - LRU cache логика
   - User isolation

**Слабые стороны:**

1. **Критическое отсутствие тестов для hooks:**
   - 35 hook файлов в `src/hooks/`
   - **0 файлов с тестами**

2. **Непокрытые критические компоненты:**
   - `ImageModal.tsx` - генерация изображений
   - `BookUploadModal.tsx` - загрузка книг
   - `ReaderControls.tsx` - управление чтением
   - `Admin/*.tsx` - 5 admin компонентов

3. **Отсутствие интеграционных тестов:**
   - Нет end-to-end тестов
   - Не покрыт полный flow "upload → parse → read"
   - Отсутствуют тесты для TanStack Query invalidation

---

### 2.2 Непокрытые Критические Модули

#### 2.2.1 Custom Hooks (35 файлов)

**Критичные hooks БЕЗ тестов:**

| Hook | Строк | Критичность | Риски |
|------|-------|-------------|-------|
| **useEpubLoader.ts** | ~300 | КРИТИЧНО | EPUB loading, authentication |
| **useCFITracking.ts** | ~350 | КРИТИЧНО | Position tracking, CFI validation |
| **useChapterManagement.ts** | ~250 | КРИТИЧНО | Chapter prefetch, LLM trigger |
| **useDescriptionHighlighting.ts** | ~566 | КРИТИЧНО | 9 search strategies |
| **useImageModal.ts** | ~200 | КРИТИЧНО | Image generation orchestration |
| **useProgressSync.ts** | ~150 | ВЫСОКАЯ | Debounced progress save |
| **useLocationGeneration.ts** | ~200 | ВЫСОКАЯ | Location generation |
| **useChapter.ts** (API) | ~150 | ВЫСОКАЯ | TanStack Query, IndexedDB cache |
| **useDescriptions.ts** (API) | ~200 | ВЫСОКАЯ | LLM extraction caching |
| **useImages.ts** (API) | ~150 | ВЫСОКАЯ | Image generation & retry |

**Пример критичного непокрытого кода:**

```typescript
// useDescriptionHighlighting.ts - 566 строк БЕЗ ТЕСТОВ
export const useDescriptionHighlighting = (config: Config) => {
  // 9 стратегий поиска описаний в тексте
  // Нет тестов для:
  // - Каждой стратегии поиска
  // - Edge cases (overlapping highlights)
  // - Performance на больших главах
  // - Memory leaks при unmount

  const strategies = [
    exactMatch,
    normalizedMatch,
    wordBoundaryMatch,
    // ... 6 more strategies
  ];
};
```

#### 2.2.2 TanStack Query Hooks

**Проблема:** Весь серверный state management НЕ покрыт тестами.

```typescript
// useBooks.ts - БЕЗ ТЕСТОВ
export const useBooks = () => {
  return useQuery({
    queryKey: queryKeys.books.list(params),
    queryFn: () => booksAPI.getBooks(params),
    // Нет тестов для:
    // - Cache invalidation
    // - Optimistic updates
    // - Error retries
    // - Stale-while-revalidate
  });
};
```

#### 2.2.3 Caching Services

```typescript
// chapterCache.ts - ЧАСТИЧНО покрыт (214 строк тестов)
// imageCache.ts - БЕЗ ТЕСТОВ (~500 строк)

// Непокрытая критичная логика:
class ImageCache {
  async cleanup() {
    // LRU eviction logic - НЕТ ТЕСТОВ
    // Quota management - НЕТ ТЕСТОВ
    // Corruption recovery - НЕТ ТЕСТОВ
  }
}
```

---

## 3. Качественный Анализ Тестов

### 3.1 Правильные Паттерны (Продолжать)

#### 3.1.1 Асинхронное Тестирование

**Хорошо:**
```python
# test_auth.py
@pytest.mark.asyncio
async def test_login_success(self, client: AsyncClient, sample_user_data):
    await client.post("/api/v1/auth/register", json=sample_user_data)
    response = await client.post("/api/v1/auth/login", ...)
    assert response.status_code == 200
```

#### 3.1.2 Комплексные Фикстуры

**Хорошо:**
```python
# conftest.py:132-147
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, sample_user_data):
    auth_service = AuthService()
    user = User(
        email=sample_user_data["email"],
        full_name=sample_user_data["full_name"],
        password_hash=auth_service.get_password_hash(...)
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user
```

#### 3.1.3 Категоризованные Тесты

**Хорошо:**
```typescript
// EpubReader.test.tsx
describe('EpubReader Component', () => {
  describe('Component Rendering', () => { /* 5 tests */ });
  describe('epub.js Integration', () => { /* 8 tests */ });
  describe('CFI Position Restoration', () => { /* 8 tests */ });
  describe('Progress Tracking', () => { /* 6 tests */ });
});
```

---

### 3.2 Анти-паттерны (Исправить)

#### 3.2.1 Условные Assertions

**Плохо:**
```python
# test_descriptions.py:58-62
if response.status_code == 200:
    data = response.json()
    assert "chapter_info" in data
    # Если status_code != 200, тест пройдёт без проверки
```

**Правильно:**
```python
assert response.status_code == 200
data = response.json()
assert "chapter_info" in data
```

#### 3.2.2 Неинформативные Assertions

**Плохо:**
```python
# test_descriptions.py:138
assert response.status_code in [200, 404, 503]
# Тест не знает, какой статус ДОЛЖЕН быть
```

**Правильно:**
```python
# Нужно знать точное ожидаемое поведение
if nlp_available:
    assert response.status_code == 200
else:
    assert response.status_code == 503
```

#### 3.2.3 Отсутствие Cleanup в Hooks

**Проблема:**
```typescript
// useDescriptionHighlighting.ts - БЕЗ ТЕСТОВ
useEffect(() => {
  // Добавляем highlights
  descriptions.forEach(desc => {
    rendition.annotations.add(...);
  });
  // Нет cleanup!
  // Риск memory leaks при unmount
}, [descriptions]);
```

**Должно быть:**
```typescript
useEffect(() => {
  const annotations = descriptions.map(desc =>
    rendition.annotations.add(...)
  );
  return () => {
    annotations.forEach(a => rendition.annotations.remove(a));
  };
}, [descriptions]);
```

#### 3.2.4 Моки Устарели

**Проблема:**
```python
# conftest.py:80-94
@pytest.fixture
def mock_nlp_processor():
    """Mock NLP processor for testing."""
    # NLP система удалена в декабре 2025!
    # Этот мок больше не актуален
```

---

## 4. Критические Пробелы по Категориям

### 4.1 Отсутствие Error Handling Тестов

#### Backend

**Непокрытые сценарии:**

1. **API Rate Limits:**
   ```python
   # gemini_extractor.py - НЕТ ТЕСТОВ
   # Google Gemini: 15 RPM limit
   # Что происходит при 429 Too Many Requests?
   ```

2. **Database Connection Loss:**
   ```python
   # reading_session_service.py - НЕТ ТЕСТОВ
   # Что происходит при потере соединения с PostgreSQL?
   ```

3. **Redis Cache Failure:**
   ```python
   # reading_session_cache.py - НЕТ ТЕСТОВ
   # Graceful degradation при Redis unavailable?
   ```

#### Frontend

**Непокрытые сценарии:**

1. **IndexedDB Quota Exceeded:**
   ```typescript
   // chapterCache.ts - ЧАСТИЧНО покрыт
   // imageCache.ts - НЕТ ТЕСТОВ
   // Что происходит при исчерпании quota?
   ```

2. **Network Offline:**
   ```typescript
   // useBooks.ts, useChapter.ts - НЕТ ТЕСТОВ
   // Offline-first strategy не протестирована
   ```

3. **EPUB Corruption:**
   ```typescript
   // useEpubLoader.ts - НЕТ ТЕСТОВ
   // Обработка corrupted EPUB файлов?
   ```

---

### 4.2 Отсутствие Integration Tests

#### Backend

**Критичные flow БЕЗ end-to-end тестов:**

1. **Full Book Upload Flow:**
   ```
   Upload EPUB → Parse → Extract Chapters →
   Trigger LLM → Extract Descriptions →
   Generate Images → Cache → Display
   ```
   **Статус:** Частично покрыт integration тестами, но LLM/Image generation не включены.

2. **Concurrent User Access:**
   ```python
   # НЕТ ТЕСТОВ для:
   # - 2 пользователя читают одну книгу
   # - Race conditions в reading_session_cache
   # - Concurrent image generation
   ```

#### Frontend

**Критичные flow БЕЗ тестов:**

1. **Full Reading Session:**
   ```
   Open Book → Load EPUB → Restore Position →
   Highlight Descriptions → Generate Image →
   Navigate → Save Progress
   ```
   **Статус:** Компоненты покрыты отдельно, но нет end-to-end теста.

2. **Offline → Online Transition:**
   ```typescript
   // НЕТ ТЕСТОВ для:
   // - User читает offline
   // - Network восстанавливается
   // - IndexedDB sync с backend
   ```

---

### 4.3 Отсутствие Performance Tests

#### Backend

**Есть частичное покрытие:**
- `test_reading_sessions_load.py` - 403 строки
- `test_jsonb_performance.py` - 538 строк
- `test_performance_n1_fix.py` - 345 строк

**Непокрытые сценарии:**

1. **LLM API Latency:**
   ```python
   # gemini_extractor.py - НЕТ ТЕСТОВ
   # - Timeout handling
   # - Slow responses (>30s)
   # - Concurrent requests queue
   ```

2. **Image Generation Queue:**
   ```python
   # imagen_generator.py - НЕТ ТЕСТОВ
   # - Multiple concurrent generations
   # - Queue overflow
   # - Priority system
   ```

#### Frontend

**НЕТ performance тестов:**

1. **Large EPUB Rendering:**
   ```typescript
   // useEpubLoader.ts - НЕТ ТЕСТОВ
   // - 10MB+ EPUB files
   // - 100+ chapters
   // - Memory consumption
   ```

2. **Description Highlighting Performance:**
   ```typescript
   // useDescriptionHighlighting.ts - НЕТ ТЕСТОВ
   // - Chapters with 100+ descriptions
   // - 9 search strategies на больших текстах
   // - Rendering lag
   ```

---

## 5. Flaky Tests

### 5.1 Идентифицированные Flaky Tests

#### Backend

1. **test_reading_sessions_tasks.py:**
   ```python
   # Строка 245 - Race condition
   @pytest.mark.asyncio
   async def test_cleanup_old_sessions():
       # Зависит от системного времени
       # Может упасть если тест выполняется медленно
       await asyncio.sleep(1.5)  # Hardcoded timeout
   ```

2. **test_book_parser.py:**
   ```python
   # Строка 890 - File system dependency
   def test_parse_large_epub():
       # Создаёт временные файлы
       # Cleanup может не отработать при ошибке
   ```

#### Frontend

1. **EpubReader.test.tsx:**
   ```typescript
   // Строка 448 - Mock timing issue
   it('generates locations correctly', async () => {
     await waitFor(() => {
       expect(useLocationGeneration).toHaveBeenCalled();
     });
     // Может упасть если mock не отработал вовремя
   });
   ```

---

### 5.2 Рекомендации по Устранению Flaky Tests

1. **Избегать hardcoded timeouts:**
   ```python
   # Плохо
   await asyncio.sleep(1.5)

   # Хорошо
   await wait_for_condition(
       lambda: session.is_expired,
       timeout=5.0,
       interval=0.1
   )
   ```

2. **Proper cleanup в fixtures:**
   ```python
   @pytest_asyncio.fixture
   async def temp_epub_file():
       file_path = create_temp_epub()
       yield file_path
       # Гарантированный cleanup
       try:
           os.remove(file_path)
       except Exception:
           pass
   ```

3. **Mock isolation:**
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
     // Reset все моки перед каждым тестом
   });

   afterEach(() => {
     vi.restoreAllMocks();
     // Восстановить оригинальные функции
   });
   ```

---

## 6. Рекомендации по Улучшению

### 6.1 Приоритет 1: КРИТИЧНО (Реализовать немедленно)

#### 6.1.1 Backend: LLM/AI Services Testing

**Файл:** `backend/tests/services/test_gemini_extractor.py`

**Минимальное покрытие (50+ тестов):**

```python
"""
Тесты для GeminiExtractor - критичный сервис для описаний.
Target: 70% покрытие, ~800 строк тестового кода.
"""

import pytest
from unittest.mock import AsyncMock, patch
from app.services.gemini_extractor import GeminiExtractor

class TestGeminiExtractorBasicFunctionality:
    """Базовый функционал."""

    @pytest.mark.asyncio
    async def test_extract_descriptions_success(self):
        """Успешное извлечение описаний."""
        extractor = GeminiExtractor(api_key="test_key")

        mock_response = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "text": '{"descriptions": [...]}'
                    }]
                }
            }]
        }

        with patch.object(extractor.gemini_client, 'generate_content',
                         return_value=mock_response):
            result = await extractor.extract_descriptions(
                chapter_text="Тёмный лес с высокими деревьями."
            )

            assert len(result) > 0
            assert result[0].type in ["location", "character", "object"]

class TestGeminiExtractorErrorHandling:
    """Error handling."""

    @pytest.mark.asyncio
    async def test_rate_limit_429(self):
        """Обработка Rate Limit 429."""
        extractor = GeminiExtractor(api_key="test_key")

        with patch.object(extractor.gemini_client, 'generate_content',
                         side_effect=Exception("429 Too Many Requests")):
            with pytest.raises(RateLimitError):
                await extractor.extract_descriptions("Text")

    @pytest.mark.asyncio
    async def test_quota_exceeded_503(self):
        """Обработка Quota Exceeded."""
        extractor = GeminiExtractor(api_key="test_key")

        with patch.object(extractor.gemini_client, 'generate_content',
                         side_effect=Exception("503 Service Unavailable")):
            # Должен вернуть пустой список или fallback
            result = await extractor.extract_descriptions("Text")
            assert result == []

    @pytest.mark.asyncio
    async def test_malformed_json_response(self):
        """Обработка некорректного JSON ответа."""
        extractor = GeminiExtractor(api_key="test_key")

        mock_response = {
            "candidates": [{
                "content": {
                    "parts": [{"text": "INVALID JSON {{{"}]
                }
            }]
        }

        with patch.object(extractor.gemini_client, 'generate_content',
                         return_value=mock_response):
            result = await extractor.extract_descriptions("Text")
            assert result == []  # Graceful degradation

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Обработка timeout (>30s)."""
        extractor = GeminiExtractor(api_key="test_key", timeout=5)

        async def slow_response(*args, **kwargs):
            await asyncio.sleep(10)
            return {"candidates": []}

        with patch.object(extractor.gemini_client, 'generate_content',
                         side_effect=slow_response):
            with pytest.raises(TimeoutError):
                await extractor.extract_descriptions("Text")

class TestGeminiExtractorTranslation:
    """Тестирование Russian → English translation."""

    @pytest.mark.asyncio
    async def test_russian_to_english_translation(self):
        """Перевод русских описаний на английский для Imagen."""
        extractor = GeminiExtractor(api_key="test_key")

        descriptions = [
            Description(text="Тёмный лес с высокими деревьями", type="location")
        ]

        result = await extractor.translate_for_imagen(descriptions)

        assert result[0].translated_text is not None
        assert "dark forest" in result[0].translated_text.lower()
        assert "tall trees" in result[0].translated_text.lower()

    @pytest.mark.asyncio
    async def test_translation_preserves_meaning(self):
        """Перевод сохраняет смысл описания."""
        # Тест с использованием snapshot testing
        pass

class TestGeminiExtractorCostOptimization:
    """Тестирование оптимизации расходов API."""

    @pytest.mark.asyncio
    async def test_token_count_estimation(self):
        """Оценка количества токенов перед запросом."""
        extractor = GeminiExtractor(api_key="test_key")

        # Large text (~10,000 слов)
        large_text = "слово " * 10000

        tokens = extractor.estimate_tokens(large_text)

        # Gemini 3.0 Flash: $0.50/1M input tokens
        expected_cost = (tokens / 1_000_000) * 0.50
        assert expected_cost < 0.01  # Не дороже 1 цента за главу

    @pytest.mark.asyncio
    async def test_caching_reduces_api_calls(self):
        """Кэширование уменьшает количество API вызовов."""
        extractor = GeminiExtractor(api_key="test_key")

        # First call
        await extractor.extract_descriptions("Same text")

        # Second call - should use cache
        with patch.object(extractor.gemini_client, 'generate_content') as mock:
            await extractor.extract_descriptions("Same text")
            mock.assert_not_called()

class TestGeminiExtractorRetryLogic:
    """Тестирование retry механизма."""

    @pytest.mark.asyncio
    async def test_retry_on_transient_error(self):
        """Retry при временной ошибке."""
        extractor = GeminiExtractor(api_key="test_key", max_retries=3)

        call_count = 0
        def mock_generate(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("500 Internal Server Error")
            return {"candidates": [{"content": {"parts": [{"text": "{}"}]}}]}

        with patch.object(extractor.gemini_client, 'generate_content',
                         side_effect=mock_generate):
            result = await extractor.extract_descriptions("Text")
            assert call_count == 3  # Retried 2 times

    @pytest.mark.asyncio
    async def test_exponential_backoff(self):
        """Exponential backoff между retries."""
        extractor = GeminiExtractor(api_key="test_key", max_retries=3)

        retry_times = []

        async def mock_generate(*args, **kwargs):
            retry_times.append(time.time())
            raise Exception("500 Internal Server Error")

        with patch.object(extractor.gemini_client, 'generate_content',
                         side_effect=mock_generate):
            try:
                await extractor.extract_descriptions("Text")
            except:
                pass

        # Проверяем delays: 1s, 2s, 4s
        assert retry_times[1] - retry_times[0] >= 1.0
        assert retry_times[2] - retry_times[1] >= 2.0

# ИТОГО: ~50 тестов, ~800 строк
```

**Аналогичные тесты для:**
- `test_imagen_generator.py` (~60 тестов, ~900 строк)
- `test_langextract_processor.py` (~40 тестов, ~600 строк)
- `test_llm_description_enricher.py` (~35 тестов, ~500 строк)

---

#### 6.1.2 Frontend: Custom Hooks Testing

**Файл:** `frontend/src/hooks/epub/__tests__/useDescriptionHighlighting.test.ts`

**Минимальное покрытие (25+ тестов):**

```typescript
/**
 * Тесты для useDescriptionHighlighting
 * Target: 80% покрытие, ~400 строк
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDescriptionHighlighting } from '../useDescriptionHighlighting';
import type { Description, Rendition } from '@/types/epub';

describe('useDescriptionHighlighting', () => {
  // ============================================================================
  // 1. SEARCH STRATEGIES (9 тестов)
  // ============================================================================

  describe('Search Strategies', () => {
    it('strategy 1: exact match', () => {
      const description: Description = {
        id: 'desc-1',
        text: 'dark forest',
        type: 'location',
        // ...
      };

      const chapterText = 'There was a dark forest in the north.';

      const result = findDescriptionInText(description, chapterText);

      expect(result.found).toBe(true);
      expect(result.startOffset).toBe(12);
      expect(result.endOffset).toBe(23);
    });

    it('strategy 2: normalized match (case-insensitive)', () => {
      const description: Description = {
        text: 'Dark Forest',
      };

      const chapterText = 'DARK FOREST in the north.';

      const result = findDescriptionInText(description, chapterText);
      expect(result.found).toBe(true);
    });

    it('strategy 3: word boundary match', () => {
      const description: Description = {
        text: 'forest',
      };

      const chapterText = 'The deforestation was bad.';

      const result = findDescriptionInText(description, chapterText);
      // Не должно найти "forest" внутри "deforestation"
      expect(result.found).toBe(false);
    });

    it('strategy 4: fuzzy match (Levenshtein distance)', () => {
      const description: Description = {
        text: 'dark forest',
      };

      // Typo: "drak" instead of "dark"
      const chapterText = 'There was a drak forest.';

      const result = findDescriptionInText(description, chapterText, {
        fuzzyThreshold: 0.8
      });

      expect(result.found).toBe(true);
    });

    // ... 5 more strategy tests
  });

  // ============================================================================
  // 2. HIGHLIGHT RENDERING (6 тестов)
  // ============================================================================

  describe('Highlight Rendering', () => {
    it('adds highlight to rendition', () => {
      const mockRendition = createMockRendition();

      const { result } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: mockRendition,
          descriptions: [mockDescription],
          enabled: true,
        })
      );

      expect(mockRendition.annotations.add).toHaveBeenCalledWith(
        'highlight',
        expect.any(String), // CFI range
        expect.any(Object), // styles
        expect.any(Function) // onClick
      );
    });

    it('applies correct CSS class for highlight', () => {
      const mockRendition = createMockRendition();

      const { result } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: mockRendition,
          descriptions: [{ ...mockDescription, type: 'location' }],
          enabled: true,
        })
      );

      const addCalls = vi.mocked(mockRendition.annotations.add).mock.calls;
      const styles = addCalls[0][2];

      expect(styles.className).toContain('description-highlight-location');
    });

    it('removes highlights on cleanup', () => {
      const mockRendition = createMockRendition();

      const { unmount } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: mockRendition,
          descriptions: [mockDescription],
          enabled: true,
        })
      );

      unmount();

      expect(mockRendition.annotations.remove).toHaveBeenCalled();
    });

    it('handles overlapping highlights', () => {
      const descriptions: Description[] = [
        { text: 'dark forest', type: 'location' },
        { text: 'dark', type: 'mood' }, // Overlapping
      ];

      const { result } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: mockRendition,
          descriptions,
          enabled: true,
        })
      );

      // Должен создать 2 highlights
      expect(mockRendition.annotations.add).toHaveBeenCalledTimes(2);
    });

    // ... 2 more rendering tests
  });

  // ============================================================================
  // 3. ERROR HANDLING (5 тестов)
  // ============================================================================

  describe('Error Handling', () => {
    it('handles missing description text', () => {
      const invalidDescription: Description = {
        text: '', // Empty text
        type: 'location',
      };

      const { result } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: mockRendition,
          descriptions: [invalidDescription],
          enabled: true,
        })
      );

      // Не должно крашиться
      expect(mockRendition.annotations.add).not.toHaveBeenCalled();
    });

    it('handles rendition not ready', () => {
      const { result } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: null, // Not ready yet
          descriptions: [mockDescription],
          enabled: true,
        })
      );

      // Должно пропустить highlighting
      expect(result.current).toBeDefined();
    });

    it('handles annotations.add failure', () => {
      const mockRendition = createMockRendition();
      vi.mocked(mockRendition.annotations.add).mockImplementation(() => {
        throw new Error('CFI error');
      });

      const { result } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: mockRendition,
          descriptions: [mockDescription],
          enabled: true,
        })
      );

      // Не должно крашиться, должно продолжить с другими highlights
      expect(result.current).toBeDefined();
    });

    // ... 2 more error tests
  });

  // ============================================================================
  // 4. PERFORMANCE (5 тестов)
  // ============================================================================

  describe('Performance', () => {
    it('handles 100+ descriptions without lag', () => {
      const manyDescriptions = Array.from({ length: 100 }, (_, i) => ({
        id: `desc-${i}`,
        text: `description ${i}`,
        type: 'location',
      }));

      const startTime = performance.now();

      const { result } = renderHook(() =>
        useDescriptionHighlighting({
          rendition: mockRendition,
          descriptions: manyDescriptions,
          enabled: true,
        })
      );

      const endTime = performance.now();

      // Должно завершиться < 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('debounces re-highlighting on description changes', () => {
      const { result, rerender } = renderHook(
        ({ descriptions }) =>
          useDescriptionHighlighting({
            rendition: mockRendition,
            descriptions,
            enabled: true,
          }),
        { initialProps: { descriptions: [mockDescription] } }
      );

      // Change descriptions multiple times rapidly
      rerender({ descriptions: [mockDescription, mockDescription2] });
      rerender({ descriptions: [mockDescription] });
      rerender({ descriptions: [mockDescription, mockDescription2] });

      // Should debounce and only highlight once after 300ms
      vi.advanceTimersByTime(300);

      expect(mockRendition.annotations.add).toHaveBeenCalledTimes(2);
    });

    // ... 3 more performance tests
  });
});

// ИТОГО: ~25 тестов, ~400 строк
```

**Аналогичные тесты для других critical hooks:**
- `useEpubLoader.test.ts` (~30 тестов, ~500 строк)
- `useCFITracking.test.ts` (~35 тестов, ~600 строк)
- `useChapterManagement.test.ts` (~25 тестов, ~400 строк)
- `useImageModal.test.ts` (~20 тестов, ~350 строк)

---

### 6.2 Приоритет 2: ВЫСОКИЙ (Реализовать в течение месяца)

#### 6.2.1 Integration Tests - Backend

**Файл:** `backend/tests/integration/test_full_book_flow.py`

```python
"""
End-to-end тест полного flow книги.
Target: 30+ тестов, ~1000 строк.
"""

import pytest
from httpx import AsyncClient

class TestFullBookFlow:
    """End-to-end тестирование полного flow."""

    @pytest.mark.asyncio
    async def test_upload_parse_extract_generate_flow(
        self,
        client: AsyncClient,
        authenticated_headers,
        sample_epub_file
    ):
        """
        Полный flow:
        1. Upload EPUB
        2. Parse chapters
        3. Extract descriptions (LLM)
        4. Generate images (Imagen)
        5. Read with highlights
        6. Save progress
        """
        headers = await authenticated_headers()

        # Step 1: Upload book
        with open(sample_epub_file, 'rb') as f:
            upload_response = await client.post(
                "/api/v1/books/upload",
                files={"file": ("test.epub", f, "application/epub+zip")},
                headers=headers
            )

        assert upload_response.status_code == 201
        book_id = upload_response.json()["book"]["id"]

        # Step 2: Wait for parsing to complete
        await wait_for_parsing(client, book_id, headers, timeout=30)

        # Step 3: Get chapters
        chapters_response = await client.get(
            f"/api/v1/books/{book_id}/chapters",
            headers=headers
        )
        assert chapters_response.status_code == 200
        chapters = chapters_response.json()["chapters"]
        assert len(chapters) > 0

        # Step 4: Trigger LLM extraction for first chapter
        desc_response = await client.get(
            f"/api/v1/books/{book_id}/chapters/1/descriptions?extract_new=true",
            headers=headers
        )
        assert desc_response.status_code == 200
        descriptions = desc_response.json()["nlp_analysis"]["descriptions"]
        assert len(descriptions) > 0

        # Step 5: Generate image for first description
        image_response = await client.post(
            f"/api/v1/images/generate/{descriptions[0]['id']}",
            headers=headers
        )
        assert image_response.status_code == 200
        image_url = image_response.json()["image"]["image_url"]
        assert image_url is not None

        # Step 6: Read and save progress
        progress_response = await client.put(
            f"/api/v1/books/{book_id}/progress",
            json={
                "current_chapter": 1,
                "current_position": 50,
                "reading_location_cfi": "epubcfi(/6/4!/4/2/1:0)"
            },
            headers=headers
        )
        assert progress_response.status_code == 200

        # Verify final state
        book_response = await client.get(
            f"/api/v1/books/{book_id}",
            headers=headers
        )
        book = book_response.json()["book"]
        assert book["is_parsed"] is True
        assert book["chapters_count"] == len(chapters)
        assert book["reading_progress_percent"] > 0

    @pytest.mark.asyncio
    async def test_concurrent_users_reading_same_book(self):
        """2 пользователя читают одну книгу одновременно."""
        # Test concurrent access, cache isolation, etc.
        pass

    # ... 28 more integration tests
```

#### 6.2.2 Integration Tests - Frontend

**Файл:** `frontend/src/__tests__/integration/FullReadingFlow.test.tsx`

```typescript
/**
 * End-to-end integration тест.
 * Использует @testing-library/react для полного user flow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';

describe('Full Reading Flow Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('complete flow: upload → parse → read → highlight → generate image', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // 1. Login
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    // 2. Upload book
    await waitFor(() => {
      expect(screen.getByText(/Загрузить книгу/i)).toBeInTheDocument();
    });

    const uploadButton = screen.getByText(/Загрузить книгу/i);
    await user.click(uploadButton);

    const fileInput = screen.getByLabelText(/выберите файл/i);
    const file = new File(['epub content'], 'test.epub', { type: 'application/epub+zip' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /загрузить/i }));

    // 3. Wait for parsing
    await waitFor(() => {
      expect(screen.getByText(/книга успешно загружена/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // 4. Open book
    const bookCard = await screen.findByText('test.epub');
    await user.click(bookCard);

    // 5. Wait for EPUB to load
    await waitFor(() => {
      expect(screen.getByTestId('epub-viewer')).toBeInTheDocument();
    }, { timeout: 3000 });

    // 6. Verify description highlighting
    await waitFor(() => {
      const highlights = document.querySelectorAll('.description-highlight');
      expect(highlights.length).toBeGreaterThan(0);
    });

    // 7. Click on highlighted description
    const firstHighlight = document.querySelector('.description-highlight');
    await user.click(firstHighlight as Element);

    // 8. Image modal opens
    await waitFor(() => {
      expect(screen.getByTestId('image-modal')).toBeInTheDocument();
    });

    // 9. Click "Generate Image" if not cached
    const generateButton = screen.queryByText(/генерировать изображение/i);
    if (generateButton) {
      await user.click(generateButton);

      // Wait for image generation
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      }, { timeout: 30000 });
    }

    // 10. Navigate to next page
    const nextButton = screen.getByLabelText(/следующая страница/i);
    await user.click(nextButton);

    // 11. Verify progress saved
    await waitFor(() => {
      // Check localStorage or API call
      expect(localStorage.getItem('reading_progress')).not.toBeNull();
    });
  });
});
```

---

### 6.3 Приоритет 3: СРЕДНИЙ (Реализовать в течение квартала)

#### 6.3.1 Component Testing - Frontend

**Недостающие тесты для компонентов:**

1. **ImageModal.test.tsx** (~300 строк, 20 тестов)
   - Image generation flow
   - Loading states
   - Error handling
   - Retry mechanism

2. **BookUploadModal.test.tsx** (~250 строк, 15 тестов)
   - File validation (EPUB/FB2)
   - Upload progress
   - Error messages
   - Success callback

3. **ReaderControls.test.tsx** (~200 строк, 12 тестов)
   - Font size controls
   - Theme switcher
   - Progress bar
   - Navigation buttons

4. **Admin компоненты тесты** (~500 строк, 30 тестов)
   - AdminHeader.test.tsx
   - AdminStats.test.tsx
   - AdminTabNavigation.test.tsx
   - AdminParsingSettings.test.tsx
   - AdminMultiNLPSettings.test.tsx

#### 6.3.2 API Client Testing - Frontend

**Файл:** `frontend/src/api/__tests__/descriptions.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { descriptionsAPI } from '../descriptions';

describe('descriptionsAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChapterDescriptions', () => {
    it('fetches descriptions for chapter', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              descriptions: [{ id: 'desc-1', text: 'test' }],
            }),
        })
      ) as any;

      const result = await descriptionsAPI.getChapterDescriptions('book-1', 1);

      expect(result.descriptions).toHaveLength(1);
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/books/book-1/chapters/1/descriptions',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('Bearer'),
          }),
        })
      );
    });

    it('handles 404 book not found', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ detail: 'Book not found' }),
        })
      ) as any;

      await expect(
        descriptionsAPI.getChapterDescriptions('invalid-id', 1)
      ).rejects.toThrow('Book not found');
    });

    it('retries on network error', async () => {
      let callCount = 0;
      global.fetch = vi.fn(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ descriptions: [] }),
        });
      }) as any;

      const result = await descriptionsAPI.getChapterDescriptions('book-1', 1);

      expect(callCount).toBe(3);
      expect(result.descriptions).toEqual([]);
    });
  });
});
```

#### 6.3.3 Cache Testing - Backend

**Файл:** `backend/tests/services/test_reading_session_cache.py`

```python
"""
Тесты для ReadingSessionCache.
Target: 60% покрытие, ~500 строк.
"""

import pytest
from unittest.mock import AsyncMock, patch
from app.services.reading_session_cache import ReadingSessionCache

class TestReadingSessionCacheBasics:
    """Базовые операции cache."""

    @pytest.mark.asyncio
    async def test_get_cached_session(self):
        """Получение кэшированной сессии."""
        cache = ReadingSessionCache(redis_client)

        # Set cache
        await cache.set(
            user_id="user-1",
            book_id="book-1",
            session_data={
                "current_chapter": 5,
                "current_position": 50,
            }
        )

        # Get cache
        result = await cache.get(user_id="user-1", book_id="book-1")

        assert result is not None
        assert result["current_chapter"] == 5

    @pytest.mark.asyncio
    async def test_cache_miss_returns_none(self):
        """Cache miss возвращает None."""
        cache = ReadingSessionCache(redis_client)

        result = await cache.get(user_id="user-999", book_id="book-999")

        assert result is None

    @pytest.mark.asyncio
    async def test_cache_expiration_ttl(self):
        """Cache expiration через TTL."""
        cache = ReadingSessionCache(redis_client, ttl=1)  # 1 second TTL

        await cache.set(
            user_id="user-1",
            book_id="book-1",
            session_data={"current_chapter": 1}
        )

        # Wait for expiration
        await asyncio.sleep(1.5)

        result = await cache.get(user_id="user-1", book_id="book-1")

        assert result is None  # Expired

class TestReadingSessionCacheErrorHandling:
    """Error handling."""

    @pytest.mark.asyncio
    async def test_redis_connection_failure(self):
        """Graceful degradation при Redis failure."""
        cache = ReadingSessionCache(redis_client)

        with patch.object(redis_client, 'get', side_effect=ConnectionError):
            result = await cache.get(user_id="user-1", book_id="book-1")

            # Должен вернуть None вместо crash
            assert result is None

    @pytest.mark.asyncio
    async def test_serialization_error_handling(self):
        """Обработка ошибок сериализации."""
        cache = ReadingSessionCache(redis_client)

        # Corrupted data in Redis
        await redis_client.set("session:user-1:book-1", "INVALID JSON {{{")

        result = await cache.get(user_id="user-1", book_id="book-1")

        # Должен вернуть None и логировать ошибку
        assert result is None

class TestReadingSessionCacheConcurrency:
    """Тестирование concurrent access."""

    @pytest.mark.asyncio
    async def test_concurrent_reads(self):
        """Concurrent reads не конфликтуют."""
        cache = ReadingSessionCache(redis_client)

        await cache.set(user_id="user-1", book_id="book-1", session_data={"ch": 1})

        # Concurrent reads
        results = await asyncio.gather(
            cache.get("user-1", "book-1"),
            cache.get("user-1", "book-1"),
            cache.get("user-1", "book-1"),
        )

        assert all(r["ch"] == 1 for r in results)

    @pytest.mark.asyncio
    async def test_race_condition_writes(self):
        """Race condition при concurrent writes."""
        cache = ReadingSessionCache(redis_client)

        # Concurrent writes
        await asyncio.gather(
            cache.set("user-1", "book-1", {"ch": 1}),
            cache.set("user-1", "book-1", {"ch": 2}),
            cache.set("user-1", "book-1", {"ch": 3}),
        )

        result = await cache.get("user-1", "book-1")

        # Последний write должен выиграть (without proper locking)
        assert result["ch"] in [1, 2, 3]

# ... 40+ more tests
```

---

## 7. Roadmap по Улучшению Тестов

### Фаза 1: Критичные Тесты (1-2 месяца)

**Цель:** Покрыть критичные сервисы минимум на 60%.

| Неделя | Задачи | Строк кода |
|--------|--------|------------|
| 1-2 | `test_gemini_extractor.py` | ~800 |
| 3-4 | `test_imagen_generator.py` | ~900 |
| 5-6 | `test_langextract_processor.py` | ~600 |
| 7-8 | Frontend hooks (5 critical) | ~2,000 |

**Deliverables:**
- 4 новых test suite для backend
- 5 новых test suite для frontend hooks
- Coverage отчёт: Backend 50%+, Frontend 30%+

---

### Фаза 2: Integration Tests (2-3 месяца)

**Цель:** End-to-end тестирование основных flows.

| Неделя | Задачи | Строк кода |
|--------|--------|------------|
| 9-10 | Backend integration tests | ~1,500 |
| 11-12 | Frontend integration tests | ~1,000 |
| 13-14 | Cross-service integration | ~800 |

**Deliverables:**
- 3 end-to-end test suite
- CI/CD интеграция
- Automated smoke tests

---

### Фаза 3: Comprehensive Coverage (3-6 месяцев)

**Цель:** 80%+ покрытие всего кода.

| Неделя | Задачи | Строк кода |
|--------|--------|------------|
| 15-18 | Component tests (frontend) | ~2,000 |
| 19-22 | Cache & performance tests | ~1,500 |
| 23-26 | Edge cases & error handling | ~1,000 |

**Deliverables:**
- Coverage отчёт: Backend 80%+, Frontend 70%+
- Performance benchmarks
- Load testing suite

---

## 8. Оценка Усилий

### 8.1 Backend

| Категория | Файлов | Тестов | Строк | Часов |
|-----------|--------|--------|-------|-------|
| **LLM Services** | 4 | ~185 | ~3,300 | 120-160 |
| **Cache Services** | 2 | ~60 | ~1,000 | 40-60 |
| **Integration** | 3 | ~50 | ~2,000 | 60-80 |
| **Error Handling** | 10 | ~100 | ~1,500 | 50-70 |
| **Total** | **19** | **~395** | **~7,800** | **270-370** |

**Примерная стоимость:** 270-370 часов × $50-100/час = **$13,500 - $37,000**

---

### 8.2 Frontend

| Категория | Файлов | Тестов | Строк | Часов |
|-----------|--------|--------|-------|-------|
| **Custom Hooks** | 10 | ~250 | ~4,000 | 150-200 |
| **Components** | 15 | ~150 | ~2,500 | 80-120 |
| **Integration** | 3 | ~30 | ~1,500 | 50-70 |
| **API Clients** | 5 | ~50 | ~800 | 30-40 |
| **Total** | **33** | **~480** | **~8,800** | **310-430** |

**Примерная стоимость:** 310-430 часов × $50-100/час = **$15,500 - $43,000**

---

### 8.3 Общая Оценка

| Метрика | Backend | Frontend | Total |
|---------|---------|----------|-------|
| **Новых файлов тестов** | 19 | 33 | 52 |
| **Новых тестов** | ~395 | ~480 | ~875 |
| **Строк кода** | ~7,800 | ~8,800 | ~16,600 |
| **Часов работы** | 270-370 | 310-430 | 580-800 |
| **Стоимость ($50-100/час)** | $13,500-$37,000 | $15,500-$43,000 | **$29,000-$80,000** |

---

## 9. Рекомендации по CI/CD

### 9.1 GitHub Actions Workflow

**Файл:** `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres123
          POSTGRES_DB: bookreader_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python 3.11
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        working-directory: ./backend
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov pytest-asyncio

      - name: Run tests with coverage
        working-directory: ./backend
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres123@localhost:5432/bookreader_test
          REDIS_URL: redis://localhost:6379
        run: |
          pytest --cov=app --cov-report=xml --cov-report=html --cov-fail-under=60

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml
          flags: backend
          fail_ci_if_error: true

  frontend-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js 20
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run tests with coverage
        working-directory: ./frontend
        run: npm run test -- --coverage --run

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/coverage-final.json
          flags: frontend
          fail_ci_if_error: true

  integration-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]

    steps:
      - uses: actions/checkout@v3

      - name: Start full stack
        run: docker-compose up -d

      - name: Wait for services
        run: |
          sleep 30
          curl --retry 10 --retry-delay 5 http://localhost:3000
          curl --retry 10 --retry-delay 5 http://localhost:8000/health

      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e
```

---

### 9.2 Coverage Requirements

**Файл:** `backend/pytest.ini`

```ini
[pytest]
minversion = 7.0
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# Coverage requirements
addopts =
    --cov=app
    --cov-report=term-missing
    --cov-report=html
    --cov-fail-under=60
    --strict-markers
    -v

# Parallel execution
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    integration: marks tests as integration tests
    unit: marks tests as unit tests
```

**Файл:** `frontend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
```

---

## 10. Заключение

### 10.1 Текущее Состояние (Summary)

| Аспект | Оценка | Статус |
|--------|--------|--------|
| **Backend Coverage** | 35-45% | НЕДОСТАТОЧНО |
| **Frontend Coverage** | 15-25% | КРИТИЧНО НИЗКО |
| **Integration Tests** | Partial | ТРЕБУЕТСЯ РАБОТА |
| **Error Handling Tests** | Minimal | КРИТИЧНО НИЗКО |
| **Performance Tests** | Partial (backend) | ТРЕБУЕТСЯ РАСШИРЕНИЕ |

---

### 10.2 Критические Риски

1. **61% backend сервисов БЕЗ тестов** - высокий риск регрессий
2. **100% custom hooks БЕЗ тестов** - невозможно рефакторить с уверенностью
3. **LLM/AI сервисы непокрыты** - расходы на API неконтролируемы
4. **Отсутствие offline tests** - offline-first стратегия не валидирована
5. **Нет E2E тестов** - критичные user flows не покрыты

---

### 10.3 Ключевые Рекомендации

**Немедленно (Priorit 1):**
1. Создать тесты для `gemini_extractor.py` и `imagen_generator.py`
2. Покрыть тестами топ-5 critical hooks
3. Настроить CI/CD с coverage enforcement

**В течение месяца (Priority 2):**
1. Реализовать end-to-end integration тесты
2. Покрыть все cache сервисы тестами
3. Добавить error handling тесты для всех API calls

**В течение квартала (Priority 3):**
1. Достичь 80% backend coverage
2. Достичь 70% frontend coverage
3. Реализовать performance benchmarks
4. Настроить automated regression testing

---

### 10.4 Ожидаемые Результаты

После реализации рекомендаций:

| Метрика | Сейчас | Цель |
|---------|--------|------|
| **Backend Coverage** | 35-45% | 80%+ |
| **Frontend Coverage** | 15-25% | 70%+ |
| **Critical Services** | 39% покрыто | 100% покрыто |
| **Custom Hooks** | 0% покрыто | 80%+ покрыто |
| **E2E Tests** | 0 | 10+ основных flows |
| **CI/CD** | Manual | Automated + Coverage enforcement |

**ROI:** Снижение production bugs на 60-70%, ускорение development на 30-40% за счёт уверенности в рефакторинге.

---

**Подготовлено:** Claude (Test Automation Engineer)
**Дата:** 26 декабря 2025
**Версия отчёта:** 1.0
