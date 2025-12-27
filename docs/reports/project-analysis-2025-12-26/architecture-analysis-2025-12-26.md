# Архитектурный анализ BookReader AI

**Дата:** 2025-12-26
**Версия проекта:** 0.1.0
**Аналитик:** Claude Opus 4.5 (Software Architecture Expert)

---

## 1. Общая оценка архитектуры

### 1.1 Архитектурный стиль

Проект реализует **модульную слоистую архитектуру** с элементами:
- Clean Architecture (частичное соблюдение)
- Service Layer Pattern
- Repository Pattern (через SQLAlchemy)
- CQRS (частично, через отдельные query/command операции)

**Общая оценка: 7.5/10**

### 1.2 Структура проекта

```
fancai-vibe-hackathon/
+-- backend/                    # FastAPI + Python 3.11
|   +-- app/
|   |   +-- core/              # Конфигурация, БД, аутентификация
|   |   +-- models/            # SQLAlchemy ORM модели
|   |   +-- routers/           # API endpoints (controllers)
|   |   +-- services/          # Бизнес-логика
|   |   +-- schemas/           # Pydantic response schemas
|   |   +-- middleware/        # HTTP middleware
|   |   +-- tasks/             # Celery задачи
|   |   +-- monitoring/        # Мониторинг
|   +-- alembic/               # Миграции БД
|   +-- tests/                 # Тесты
+-- frontend/                   # React 19 + TypeScript
|   +-- src/
|   |   +-- api/               # API клиенты
|   |   +-- components/        # React компоненты
|   |   +-- hooks/             # Custom hooks (api, epub, reader)
|   |   +-- stores/            # Zustand stores
|   |   +-- services/          # Кэширование (IndexedDB)
|   |   +-- pages/             # Page components
|   |   +-- types/             # TypeScript типы
+-- docker-compose.yml          # Оркестрация сервисов
```

---

## 2. Анализ Backend архитектуры

### 2.1 Слои и их ответственности

| Слой | Директория | Ответственность | Соблюдение SRP |
|------|------------|-----------------|----------------|
| Presentation | `routers/` | HTTP endpoints, validation | 8/10 |
| Application | `services/` | Бизнес-логика | 7/10 |
| Domain | `models/` | ORM entities | 6/10 |
| Infrastructure | `core/` | DB, cache, auth | 8/10 |

### 2.2 Положительные аспекты

1. **Модульная структура сервисов** - Сервисы книг разбиты на 4 файла:
   - `book_service.py` - CRUD операции
   - `book_progress_service.py` - Прогресс чтения
   - `book_parsing_service.py` - Парсинг книг
   - `book_statistics_service.py` - Статистика

2. **Dependency Injection через FastAPI** - Использование `Depends()` для:
   - Сессий БД (`get_database_session`)
   - Аутентификации (`get_current_active_user`)
   - Проверки доступа к ресурсам (`get_user_book`, `get_user_chapter`)

3. **Кастомные исключения** - Централизованная система ошибок в `core/exceptions.py`:
   ```python
   # /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/core/exceptions.py
   class BookNotFoundException(HTTPException)
   class ChapterAccessDeniedException(HTTPException)
   class ImageNotFoundException(HTTPException)
   ```

4. **Pydantic schemas** - Строгая типизация response/request моделей

5. **Redis caching** - Эффективное кэширование с TTL и pattern-based invalidation

### 2.3 Найденные проблемы

#### ВЫСОКАЯ КРИТИЧНОСТЬ

**2.3.1 Глобальные синглтоны вместо DI**

**Проблема:** Сервисы создаются как глобальные синглтоны в конце модулей, что:
- Нарушает Dependency Inversion Principle
- Усложняет тестирование (mock заменяет глобальный объект)
- Создает неявные зависимости

**Примеры:**
```python
# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/services/book_parser.py (строка 925)
book_parser = BookParser()

# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/services/book/book_service.py (строка 401)
book_service = BookService()

# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/services/auth_service.py (строка 373)
auth_service = AuthService()
```

**Затронуто:** 12 сервисов

**Рекомендация:** Использовать FastAPI Depends для инъекции сервисов:
```python
# Вместо:
from ..services.book import book_service

# Использовать:
def get_book_service() -> BookService:
    return BookService()

async def endpoint(
    book_service: BookService = Depends(get_book_service)
):
    ...
```

---

**2.3.2 Бизнес-логика в ORM моделях**

**Проблема:** Модель `Book` содержит бизнес-логику расчета прогресса чтения (70+ строк):

```python
# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/models/book.py (строки 138-268)
class Book(Base):
    # ...
    def get_user_progress(self, user_id: UUID) -> "ReadingProgress | None":
        # 20 строк логики

    def calculate_progress_percent(self, user_id: UUID) -> float:
        # 40 строк логики

    async def get_reading_progress_percent(self, db: AsyncSession, user_id: UUID) -> float:
        # 40 строк с async DB query
```

**Нарушения:**
- Single Responsibility Principle (модель = данные + логика)
- Зависимость модели от db session (анемичная модель)
- Сложность тестирования

**Рекомендация:** Перенести логику в `BookProgressService`:
```python
class BookProgressService:
    async def calculate_progress_percent(
        self, db: AsyncSession, book: Book, user_id: UUID
    ) -> float:
        # Логика здесь
```

---

**2.3.3 Отладочные print-statements в production коде**

**Проблема:** 453 вызова `print()` в production коде backend

**Примеры:**
```python
# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/routers/books/crud.py
print(f"[UPLOAD] Request received from user: {current_user.email}")
print(f"[BOOKS ENDPOINT] Cache HIT for user {current_user.id}")
```

**Рекомендация:** Заменить на `loguru` или стандартный `logging`:
```python
from loguru import logger
logger.info(f"Upload request from user: {current_user.email}")
```

---

#### СРЕДНЯЯ КРИТИЧНОСТЬ

**2.3.4 Смешение слоев в роутерах**

**Проблема:** Роутеры содержат бизнес-логику вместо делегирования сервисам:

```python
# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/routers/books/crud.py (строки 246-320)
@router.get("/", response_model=BookListResponse)
async def get_user_books(...):
    # 75 строк логики формирования ответа
    # Должно быть в сервисе
    for book, reading_progress in books_with_progress:
        books_data.append({
            "id": str(book.id),
            "title": book.title,
            # ... 20+ полей
        })
```

**Рекомендация:** Вынести в BookService:
```python
# service
async def get_user_books_response(self, db, user_id, params) -> BookListResponse:
    ...

# router
@router.get("/")
async def get_user_books(...):
    return await book_service.get_user_books_response(db, user_id, params)
```

---

**2.3.5 Незавершенные TODO в критичных местах**

```python
# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/main.py (строка 283)
"database": "checking...",  # TODO: добавить проверку БД

# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/routers/images.py (строки 124-125)
completed_today=0,  # TODO: implement tracking
failed_today=0,  # TODO: implement tracking
```

---

**2.3.6 Устаревшие NLP настройки в конфигурации**

```python
# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/app/core/config.py (строки 73-78)
# Multi-NLP Configuration (October 2025)
MULTI_NLP_MODE: str = Field(default="ensemble", env="MULTI_NLP_MODE")
CONSENSUS_THRESHOLD: float = Field(default=0.6, ...)
SPACY_WEIGHT: float = Field(default=1.0, ...)
NATASHA_WEIGHT: float = Field(default=1.2, ...)
STANZA_WEIGHT: float = Field(default=0.8, ...)
```

**Проблема:** NLP система удалена в декабре 2025, но конфигурация осталась

---

#### НИЗКАЯ КРИТИЧНОСТЬ

**2.3.7 Дублирование Volume-монтирования NLP моделей**

```yaml
# /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/docker-compose.yml
# Для backend:
- nlp_nltk_data:/root/nltk_data
- nlp_stanza_models:/tmp/stanza_resources
# Для celery-worker - те же volumes

# NLP удалена, но volumes остались
```

---

## 3. Анализ Frontend архитектуры

### 3.1 Положительные аспекты

1. **Модульные hooks** - 17 специализированных hooks для EPUB reader:
   ```
   /frontend/src/hooks/epub/
   +-- useEpubLoader.ts        # Загрузка EPUB
   +-- useCFITracking.ts       # Отслеживание позиции
   +-- useChapterManagement.ts # Управление главами
   +-- useDescriptionHighlighting.ts # Подсветка описаний
   ```

2. **TanStack Query** - Правильное управление серверным состоянием:
   ```typescript
   // /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/frontend/src/hooks/api/useBooks.ts
   export function useBooks(params?: BooksListParams) {
     return useQuery({
       queryKey: bookKeys.list(userId, params),
       staleTime: 5 * 60 * 1000,
       refetchInterval: (query) => {
         // Adaptive polling для processing books
       }
     });
   }
   ```

3. **Централизованные query keys** - Файл `queryKeys.ts` с фабриками ключей

4. **IndexedDB caching** - Оффлайн-кэширование глав и изображений

5. **Lazy loading** - Разделение кода для тяжелых страниц:
   ```typescript
   const BookReaderPage = lazy(() => import('@/pages/BookReaderPage'));
   ```

### 3.2 Найденные проблемы

#### ВЫСОКАЯ КРИТИЧНОСТЬ

**3.2.1 Смешение localStorage доступа**

**Проблема:** 50+ прямых вызовов `localStorage` вместо централизованного хранилища

**Примеры:**
```typescript
// /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/frontend/src/components/Reader/EpubReader.tsx (строка 90)
const authToken = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

// /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/frontend/src/stores/auth.ts (12 вызовов)
localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access_token);
```

**Рекомендация:** Создать StorageService:
```typescript
class StorageService {
  getAuthToken(): string | null
  setAuthToken(token: string): void
  // ...
}
```

---

**3.2.2 Избыточное логирование в production**

**Проблема:** 281 вызов `console.log/warn/error` в production коде

```typescript
// /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/frontend/src/stores/auth.ts
console.log('Login successful for:', user.email);
console.log('Saving tokens to localStorage...');
console.log('Data saved to localStorage');
```

**Рекомендация:** Использовать условное логирование:
```typescript
const logger = {
  log: (...args) => import.meta.env.DEV && console.log(...args),
  error: console.error, // Ошибки всегда логируем
}
```

---

#### СРЕДНЯЯ КРИТИЧНОСТЬ

**3.2.3 109 файлов .bak в репозитории**

**Проблема:** Backup файлы засоряют кодовую базу:
```
frontend/src/App.tsx.bak
frontend/src/stores/auth.ts.bak
frontend/src/hooks/epub/useEpubLoader.ts.bak
```

**Рекомендация:** Удалить все .bak файлы и добавить в .gitignore:
```bash
*.bak
```

---

**3.2.4 Компонент EpubReader слишком большой**

**Файл:** `/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/frontend/src/components/Reader/EpubReader.tsx`
**Строк:** 640

**Проблема:** Несмотря на декомпозицию в hooks, компонент все еще содержит:
- 18 импортированных hooks
- 10+ useEffect
- 5+ useState
- Сложную логику инициализации позиции (90+ строк)

**Рекомендация:** Выделить логику инициализации в отдельный hook:
```typescript
const { isRestoring, error } = usePositionRestoration({
  rendition,
  bookId: book.id,
  locations,
});
```

---

**3.2.5 Отсутствие Error Boundaries для критичных компонентов**

Только один глобальный ErrorBoundary. Рекомендуется добавить для:
- EpubReader (критичный компонент)
- ImageModal
- Library page

---

## 4. Анализ SOLID принципов

### 4.1 Single Responsibility Principle (SRP)

| Компонент | Соблюдение | Проблемы |
|-----------|------------|----------|
| BookService | 9/10 | Хорошо разделен на 4 сервиса |
| Book model | 5/10 | Содержит бизнес-логику |
| EpubReader | 6/10 | Слишком много ответственностей |
| useBooks hook | 9/10 | Чистый API hook |

### 4.2 Open/Closed Principle (OCP)

| Компонент | Соблюдение | Комментарий |
|-----------|------------|-------------|
| Image generators | 8/10 | Легко добавить новый генератор |
| Description extractors | 7/10 | Gemini + LangExtract адаптеры |
| Book parsers | 9/10 | EPUB + FB2 через единый интерфейс |

### 4.3 Liskov Substitution Principle (LSP)

**Соблюдается:** Все исключения наследуются от HTTPException и взаимозаменяемы.

### 4.4 Interface Segregation Principle (ISP)

**Частично соблюдается:** Нет явных интерфейсов (Python duck typing), но сервисы имеют узкие методы.

### 4.5 Dependency Inversion Principle (DIP)

| Уровень | Соблюдение | Проблемы |
|---------|------------|----------|
| Routers -> Services | 4/10 | Глобальные синглтоны вместо DI |
| Services -> Models | 8/10 | Через SQLAlchemy session |
| Frontend -> API | 9/10 | Через абстрактный apiClient |

---

## 5. Анализ связанности (Coupling)

### 5.1 Backend coupling

```
                    +----------------+
                    |    Routers     |
                    +--------+-------+
                             |
              +----+---------+---------+----+
              |              |              |
     +--------v----+  +------v------+  +----v-------+
     | BookService |  | AuthService |  | ImageGen   |
     +------+------+  +-------------+  +-----+------+
            |                               |
     +------v------+                 +------v------+
     |    Models   |<----------------|   External  |
     +-------------+                 |   APIs      |
                                     +-------------+
```

**Проблемы:**
1. Routers импортируют глобальные сервисы (tight coupling)
2. Сервисы импортируют друг друга напрямую

### 5.2 Frontend coupling

```
                    +---------------+
                    |    Pages      |
                    +-------+-------+
                            |
              +-------------+-------------+
              |                           |
     +--------v--------+         +--------v--------+
     |   Components    |         |   Hooks (API)   |
     +--------+--------+         +--------+--------+
              |                           |
     +--------v--------+         +--------v--------+
     |   Hooks (epub)  |         |   API Client    |
     +-----------------+         +-----------------+
```

**Хорошо:** Чистое разделение через hooks
**Проблема:** Компоненты напрямую используют localStorage

---

## 6. Рекомендации по улучшению

### 6.1 Приоритет: Высокий

1. **Внедрить DI для сервисов backend**
   - Создать фабричные функции для Depends
   - Удалить глобальные синглтоны
   - Упростит тестирование

2. **Заменить print на structured logging**
   - Использовать loguru или structlog
   - Настроить уровни логирования
   - Добавить correlation IDs

3. **Очистить устаревший NLP код**
   - Удалить NLP настройки из config.py
   - Удалить NLP volumes из docker-compose
   - Очистить .bak файлы

### 6.2 Приоритет: Средний

4. **Вынести бизнес-логику из моделей**
   - Перенести calculate_progress в BookProgressService
   - Модели должны быть чистыми data containers

5. **Создать StorageService для frontend**
   - Централизовать доступ к localStorage
   - Добавить TypeScript типизацию

6. **Добавить Error Boundaries**
   - Для EpubReader
   - Для критичных модальных окон

### 6.3 Приоритет: Низкий

7. **Декомпозиция EpubReader**
   - Вынести логику инициализации позиции
   - Создать container/presenter компоненты

8. **Завершить TODO**
   - Реализовать health check БД
   - Добавить трекинг генерации изображений

---

## 7. Метрики качества

| Метрика | Значение | Целевое |
|---------|----------|---------|
| Cyclomatic Complexity (avg) | 8.2 | < 10 |
| Lines per file (max) | 925 (book_parser.py) | < 500 |
| Test Coverage (backend) | ~65% | > 80% |
| Test Coverage (frontend) | ~40% | > 70% |
| TODO items | 9 | 0 |
| .bak files | 109 | 0 |
| print() statements | 453 | 0 |
| console.log statements | 281 | ~50 (errors only) |

---

## 8. Заключение

### 8.1 Сильные стороны

1. Хорошая модульность сервисного слоя
2. Эффективное использование TanStack Query
3. Грамотная система кастомных исключений
4. Продуманная система кэширования (Redis + IndexedDB)
5. Lazy loading для оптимизации bundle size

### 8.2 Области для улучшения

1. Переход от глобальных синглтонов к DI
2. Очистка от отладочного кода
3. Удаление устаревшего NLP кода
4. Строгое разделение слоев (особенно в роутерах)

### 8.3 Общая оценка

**Архитектурная зрелость: 7.5/10**

Проект демонстрирует хорошие архитектурные решения (модульность, кэширование, типизация), но имеет технический долг в виде глобальных синглтонов, отладочного кода и смешения ответственностей в некоторых компонентах.

---

*Отчет составлен автоматически с помощью Claude Opus 4.5 Architecture Expert Agent*
