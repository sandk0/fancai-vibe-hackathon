# Комплексный анализ проекта BookReader AI

**Дата:** 23 декабря 2025
**Версия:** 1.2 (проверено на production сервере 77.246.106.109)
**Аналитик:** Claude Opus 4.5

---

## Оглавление

1. [Резюме анализа](#1-резюме-анализа)
2. [Критические проблемы](#2-критические-проблемы)
3. [Проблемы архитектуры](#3-проблемы-архитектуры)
4. [Проблемы кеширования](#4-проблемы-кеширования)
5. [Проблемы типизации](#5-проблемы-типизации)
6. [Проблемы React паттернов](#6-проблемы-react-паттернов)
7. [Проблемы Backend](#7-проблемы-backend)
8. [Проблемы базы данных](#8-проблемы-базы-данных) ⚠️ **NEW**
9. [Проблемы тестирования](#9-проблемы-тестирования)
10. [План доработок](#10-план-доработок)
11. [Приложения](#11-приложения)

---

## 1. Резюме анализа

### Статус компонентов

| Компонент | Инструмент | Статус | Критичность |
|-----------|------------|--------|-------------|
| Backend Types | mypy | ✅ PASS | - |
| Backend Linting | ruff | ⚠️ 50 issues | Medium |
| Frontend Types | TypeScript | ❌ 34+ errors | High |
| Frontend Linting | ESLint | ⚠️ 6 issues | Low |
| Backend Tests | pytest | ❌ 29 collection errors | Critical |
| Frontend Tests | vitest | ❌ 7 failed suites | Critical |
| Auth Cache | Manual | ❌ Not invalidated | Critical |
| **Database** | **Production** | **✅ All migrations applied** | **OK** |
| **DB Schema** | **Production** | **⚠️ Missing CASCADE DELETE** | **High** |

### Ключевые находки

1. **✅ БД синхронизирована** - все миграции применены на production (версия `add_is_processing_20251220`)
2. **Критическая проблема с кешем при авторизации** - данные предыдущего пользователя остаются после re-login
3. **⚠️ Отсутствуют CASCADE DELETE** - 5 FK без каскадного удаления
4. **Дублирование state management** - TanStack Query + Zustand stores конкурируют
5. **Массовое использование `eslint-disable`** - 35+ директив скрывают потенциальные баги
6. **Orphan NLP тесты** - 30+ файлов тестов ссылаются на удалённый код
7. **React Hooks violations** - `useQueryClient()` вызывается внутри `queryFn`

---

## 2. Критические проблемы

### 2.1 Stale Cache после авторизации

**Симптом:** После повторного логина пользователь видит старые книги, которые были в кеше.

**Корневая причина:**

```
┌────────────────────────────────────────────────────────────────┐
│                         КЕШИ НЕ ОЧИЩАЮТСЯ                       │
├──────────────────┬───────────────────┬─────────────────────────┤
│  logout() не     │ TanStack Query    │ IndexedDB хранит        │
│  очищает кеши    │ cache остаётся    │ данные без userId       │
└──────────────────┴───────────────────┴─────────────────────────┘
```

**Затронутые файлы:**
- `frontend/src/stores/auth.ts:80-97` - logout без очистки
- `frontend/src/App.tsx:57-65` - queryClient недоступен
- `frontend/src/services/chapterCache.ts` - нет привязки к userId
- `frontend/src/services/imageCache.ts` - нет привязки к userId

**Приоритет:** 🔴 CRITICAL

---

### 2.2 React Hook Violation

**Файл:** `frontend/src/hooks/api/useDescriptions.ts:181`

```typescript
// ❌ VIOLATION: Hook called inside queryFn (not a React component/hook)
queryFn: async () => {
  const queryClient = useQueryClient(); // This breaks Rules of Hooks!
  // ...
}
```

**Последствия:** Непредсказуемое поведение, возможные runtime crashes.

**Приоритет:** 🔴 CRITICAL

---

### 2.3 Orphan NLP Tests

После удаления Multi-NLP системы (December 2025) остались тесты, импортирующие несуществующие модули:

```
ModuleNotFoundError: No module named 'app.services.nlp'
```

**Затронутые файлы (30+):**
- `tests/services/nlp/` - вся директория
- `tests/services/test_gliner_processor.py`
- `tests/services/test_natasha_processor.py`
- `tests/services/test_spacy_processor.py`
- `tests/services/test_stanza_processor.py`
- `tests/test_multi_nlp_manager.py`
- `tests/test_celery_tasks.py` (NLP tasks)

**Приоритет:** 🔴 CRITICAL (блокирует CI/CD)

---

### 2.4 Missing Test Dependency

**Ошибка:**
```
Failed to resolve import "fake-indexeddb/auto" from "src/test/setup.ts"
```

**Решение:** `npm install -D fake-indexeddb`

**Приоритет:** 🔴 CRITICAL (блокирует frontend tests)

---

## 3. Проблемы архитектуры

### 3.1 Дублирование State Management

**Проблема:** TanStack Query и Zustand stores управляют одними данными.

| Данные | TanStack Query | Zustand Store | Конфликт |
|--------|----------------|---------------|----------|
| Books list | `useBooks()` | `useBooksStore.books` | ✅ Да |
| Current book | `useBook()` | `useBooksStore.currentBook` | ✅ Да |
| Reading progress | - | `useReaderStore.readingProgress` | ⚠️ Partial |

**Последствия:**
- Рассинхронизация данных
- Двойные API запросы
- Сложность отладки

**Рекомендация:** Использовать только TanStack Query для server state, Zustand только для client state (UI preferences).

---

### 3.2 Reader Store без User Isolation

**Файл:** `frontend/src/stores/reader.ts`

```typescript
persist(
  (set, get) => ({
    readingProgress: {},  // ❌ Не привязано к userId
    bookmarks: {},        // ❌ Не привязано к userId
    highlights: {},       // ❌ Не привязано к userId
  }),
  {
    name: 'reader-storage',  // Единый ключ для всех пользователей!
  }
)
```

**Последствия:** Bookmarks и highlights одного пользователя видны другому.

---

### 3.3 QueryClient не экспортируется

**Файл:** `frontend/src/App.tsx:57-65`

```typescript
// QueryClient создан внутри модуля, не экспортируется
const queryClient = new QueryClient({...});
```

**Последствия:** Невозможно очистить кеш из других модулей (auth.ts).

---

## 4. Проблемы кеширования

### 4.1 Отсутствие очистки при logout

**Текущее поведение `logout()`:**
```typescript
// frontend/src/stores/auth.ts:80-97
logout: () => {
  authAPI.logout().catch(console.error);

  // ✅ Очищается
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER_DATA);

  // ❌ НЕ очищается
  // - TanStack Query cache (in-memory)
  // - IndexedDB chapterCache
  // - IndexedDB imageCache
  // - Zustand reader store (bookmarks, highlights)
}
```

### 4.2 Отсутствие очистки при login

```typescript
// frontend/src/stores/auth.ts:21-48
login: async (email, password) => {
  // ❌ Нет очистки старых данных ПЕРЕД логином
  const response = await authAPI.login({ email, password });
  // Сразу сохраняем новые данные
}
```

### 4.3 IndexedDB без userId

| Сервис | Текущий ключ | Проблема |
|--------|--------------|----------|
| chapterCache | `${bookId}_${chapterNumber}` | Нет userId |
| imageCache | `${bookId}_${descriptionId}` | Нет userId |

---

## 5. Проблемы типизации

### 5.1 Массовое использование `@typescript-eslint/no-explicit-any`

**Количество:** 15+ файлов с отключённым правилом

**Файлы с `/* eslint-disable @typescript-eslint/no-explicit-any */`:**
- `hooks/epub/useContentHooks.ts`
- `hooks/epub/useCFITracking.ts`
- `hooks/epub/useLocationGeneration.ts`
- `hooks/epub/useImageModal.ts`
- `hooks/epub/useChapterManagement.ts`
- `hooks/epub/useDescriptionHighlighting.ts`
- `hooks/epub/useEpubLoader.ts`
- `hooks/reader/useAutoParser.ts`
- `pages/LoginPage.tsx`
- `pages/AdminDashboardEnhanced.tsx`
- `stores/images.ts`
- И другие...

**Рекомендация:** Создать proper types для epub.js и постепенно убрать `any`.

### 5.2 TypeScript ошибки в тестах

**Количество:** 34+ ошибок

**Основные проблемы:**
- Неполные mock types для `epub.js` (Book, Rendition, EpubLocations)
- `ChapterInfo` missing `book_id` property
- `Description` missing `cfi_range` property

---

## 6. Проблемы React паттернов

### 6.1 Отключение exhaustive-deps

**Количество:** 12+ файлов с `/* eslint-disable react-hooks/exhaustive-deps */`

**Проблемные файлы:**
- `components/Reader/EpubReader.tsx` - полное отключение
- `components/UI/ParsingOverlay.tsx` - полное отключение
- `hooks/useReadingSession.ts` - полное отключение
- `services/websocket.tsx` - полное отключение

**Риски:**
- Stale closures
- Infinite loops
- Missing re-renders
- Memory leaks

### 6.2 useCallback/useMemo без зависимостей

**Пример из `useChapterNavigation.ts:78`:**
```typescript
// eslint-disable-line react-hooks/exhaustive-deps
}, [currentPage, currentChapter, setCurrentPage, setCurrentChapter]);
```

Зависимости указаны, но правило отключено - возможно есть скрытые проблемы.

---

## 7. Проблемы Backend

### 7.1 Ruff Linting Issues

**Количество:** 50 ошибок

| Категория | Количество | Описание |
|-----------|------------|----------|
| F401 | ~33 | Unused imports |
| E402 | ~12 | Module level import not at top |
| F811 | ~3 | Redefinition of unused name |
| E712 | ~1 | Comparison to True |

**Auto-fixable:** 33 из 50

### 7.2 Pydantic V1 Deprecations

```python
# Deprecated:
@validator("field")          # → @field_validator
min_items=1                  # → min_length=1
json_encoders={...}          # → model_serializer
class Config:                # → model_config = ConfigDict(...)
```

### 7.3 FastAPI Deprecations

```python
# Deprecated:
@app.on_event("startup")     # → lifespan context manager
@app.on_event("shutdown")    # → lifespan context manager
```

### 7.4 NLP Configuration Remains

**Файл:** `backend/app/core/config.py:69-78`

```python
# NLP настройки (DEPRECATED - NLP removed December 2025)
SPACY_MODEL: str = "ru_core_news_lg"
NLTK_DATA_PATH: str = "./nltk_data"
MULTI_NLP_MODE: str = Field(default="ensemble", ...)
```

Эти настройки больше не используются и должны быть удалены.

---

## 8. Проблемы базы данных

> **Примечание:** Анализ проведён на production сервере **77.246.106.109**
> База данных: `bookreader_dev`, пользователь: `postgres`

### 8.1 ✅ Статус миграций (OK)

**Текущая версия в БД:** `add_is_processing_20251220` (последняя)

```
alembic_version: add_is_processing_20251220 ✅ LATEST
```

**Все таблицы присутствуют:**
- `users`, `books`, `chapters`, `descriptions` ✅
- `generated_images`, `reading_progress`, `reading_sessions` ✅
- `reading_goals`, `feature_flags`, `subscriptions` ✅

---

### 8.2 ✅ Таблица descriptions EXISTS

| Компонент | Статус |
|-----------|--------|
| Модель `Description` | ✅ Существует (`app/models/description.py`) |
| Таблица `descriptions` | ✅ Существует в БД |
| FK `descriptions_chapter_id_fkey` | ✅ ON DELETE CASCADE |

---

### 8.3 ✅ Колонка books.is_processing EXISTS

| Компонент | Статус |
|-----------|--------|
| Модель `Book.is_processing` | ✅ Объявлена в модели |
| Колонка в БД | ✅ `is_processing boolean NOT NULL DEFAULT false` |

---

### 8.4 ⚠️ Отсутствие CASCADE DELETE

**FK БЕЗ ON DELETE CASCADE (подтверждено на production):**

| Таблица | FK | Текущее поведение | Рекомендация |
|---------|----|-------------------|--------------|
| `books` | `user_id → users.id` | NO ACTION | ADD CASCADE |
| `chapters` | `book_id → books.id` | NO ACTION | ADD CASCADE |
| `reading_progress` | `book_id → books.id` | NO ACTION | ADD CASCADE |
| `reading_progress` | `user_id → users.id` | NO ACTION | ADD CASCADE |
| `generated_images` | `user_id → users.id` | NO ACTION | ADD CASCADE |

**FK С CASCADE (уже настроены корректно):**

| Таблица | FK | Поведение |
|---------|----|-----------|
| `reading_sessions` | `book_id → books.id` | ✅ ON DELETE CASCADE |
| `descriptions` | `chapter_id → chapters.id` | ✅ ON DELETE CASCADE |
| `generated_images` | `description_id → descriptions.id` | ✅ ON DELETE CASCADE |
| `generated_images` | `chapter_id → chapters.id` | ✅ ON DELETE CASCADE |

**Последствия отсутствия CASCADE:**
- Удаление пользователя оставит orphan записи в books, reading_progress, generated_images
- Удаление книги оставит orphan chapters и progress
- Нарушение целостности данных
- Потенциальные ошибки при повторных операциях

**Миграция для исправления:**
```python
# alembic revision -m "add_cascade_delete_constraints"
def upgrade():
    # Drop old constraints
    op.drop_constraint('books_user_id_fkey', 'books', type_='foreignkey')
    op.drop_constraint('chapters_book_id_fkey', 'chapters', type_='foreignkey')
    op.drop_constraint('reading_progress_book_id_fkey', 'reading_progress', type_='foreignkey')
    op.drop_constraint('reading_progress_user_id_fkey', 'reading_progress', type_='foreignkey')
    op.drop_constraint('generated_images_user_id_fkey', 'generated_images', type_='foreignkey')

    # Recreate with CASCADE
    op.create_foreign_key('books_user_id_fkey', 'books', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('chapters_book_id_fkey', 'chapters', 'books', ['book_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('reading_progress_book_id_fkey', 'reading_progress', 'books', ['book_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('reading_progress_user_id_fkey', 'reading_progress', 'users', ['user_id'], ['id'], ondelete='CASCADE')
    op.create_foreign_key('generated_images_user_id_fkey', 'generated_images', 'users', ['user_id'], ['id'], ondelete='CASCADE')
```

---

### 8.5 Устаревшие Feature Flags

**Таблица feature_flags может содержать NLP флаги:**

| Flag | Status | Проблема |
|------|--------|----------|
| `USE_NEW_NLP_ARCHITECTURE` | enabled | NLP удалён |
| `ENABLE_ENSEMBLE_VOTING` | enabled | NLP удалён |
| `ENABLE_PARALLEL_PROCESSING` | enabled | NLP удалён |
| `USE_LLM_ENRICHMENT` | disabled | NLP удалён |

**Рекомендация:** Удалить или обновить NLP-related флаги.

---

### 8.6 Enum Types: Модель vs БД

| Enum | В модели | В БД | Соответствие |
|------|----------|------|--------------|
| `SubscriptionPlan` | Python Enum | PostgreSQL ENUM | ✅ OK |
| `SubscriptionStatus` | Python Enum | PostgreSQL ENUM | ✅ OK |
| `DescriptionType` | Python Enum | PostgreSQL ENUM `descriptiontype` | ✅ OK |
| `ImageService` | Python Enum → String | CHECK constraint | ✅ OK |
| `ImageStatus` | Python Enum → String | CHECK constraint | ✅ OK |
| `BookFormat` | Python Enum → String | CHECK constraint | ✅ OK |
| `BookGenre` | Python Enum → String | CHECK constraint | ✅ OK |

---

## 9. Проблемы тестирования

### 8.1 Backend Tests

| Метрика | Значение |
|---------|----------|
| Collection errors | 29 |
| Warnings | 42 |
| Passed | N/A (blocked) |

**Причины:**
- Orphan NLP test files
- Missing NLP modules
- Unregistered pytest marks

### 8.2 Frontend Tests

| Метрика | Значение |
|---------|----------|
| Failed suites | 7 |
| Root cause | Missing fake-indexeddb |

### 8.3 Docker Obsolete Volumes

```yaml
# docker-compose.yml - больше не нужны после удаления NLP
volumes:
  nlp_nltk_data:        # ❌ Удалить
  nlp_stanza_models:    # ❌ Удалить
  nlp_huggingface_cache: # ❌ Удалить
```

---

## 9. План доработок

### Фаза 0: ✅ ВЫПОЛНЕНО - БД синхронизирована

> **Проверено на production сервере 77.246.106.109**
> - Версия alembic: `add_is_processing_20251220` (последняя)
> - Все таблицы присутствуют
> - Все колонки соответствуют моделям

---

### Фаза 1: Критические исправления (Немедленно)

| # | Задача | Файлы | Сложность | Время |
|---|--------|-------|-----------|-------|
| 1.1 | Создать `lib/queryClient.ts` с экспортом | Новый файл | Low | 30 мин |
| 1.2 | Создать `utils/cacheManager.ts` | Новый файл | Low | 1 час |
| 1.3 | Обновить `logout()` с очисткой кешей | `stores/auth.ts` | Medium | 1 час |
| 1.4 | Обновить `login()` с очисткой кешей | `stores/auth.ts` | Medium | 1 час |
| 1.5 | Исправить React Hook violation | `hooks/api/useDescriptions.ts` | Low | 30 мин |
| 1.6 | Установить fake-indexeddb | `package.json` | Low | 5 мин |
| 1.7 | Удалить orphan NLP тесты | `tests/services/nlp/` | Low | 30 мин |

**Итого Фаза 1:** ~5 часов

### Фаза 2: Рефакторинг кеширования (1-2 дня)

| # | Задача | Описание |
|---|--------|----------|
| 2.1 | Добавить userId в query keys | `hooks/api/queryKeys.ts` |
| 2.2 | Добавить userId в IndexedDB ключи | `services/chapterCache.ts`, `imageCache.ts` |
| 2.3 | Добавить user-scoped persistence в reader store | `stores/reader.ts` |
| 2.4 | Создать watcher для смены пользователя | `stores/auth.ts` |
| 2.5 | Удалить дублирующий books state из Zustand | `stores/books.ts` |

### Фаза 3: TypeScript improvements (2-3 дня)

| # | Задача | Описание |
|---|--------|----------|
| 3.1 | Создать proper types для epub.js | `types/epub.d.ts` |
| 3.2 | Убрать `any` из epub hooks | 10+ файлов |
| 3.3 | Исправить TypeScript ошибки в тестах | Mock types |
| 3.4 | Добавить strict mode checks | `tsconfig.json` |

### Фаза 4: React patterns fixes (2-3 дня)

| # | Задача | Описание |
|---|--------|----------|
| 4.1 | Убрать blanket eslint-disable | EpubReader.tsx, etc. |
| 4.2 | Исправить missing dependencies | useEffect hooks |
| 4.3 | Добавить proper cleanup в useEffects | Memory leaks |
| 4.4 | Использовать useCallback где нужно | Performance |

### Фаза 5: Backend cleanup (1 день)

| # | Задача | Команда/Описание |
|---|--------|------------------|
| 5.1 | Auto-fix ruff issues | `ruff check app/ --fix` |
| 5.2 | Удалить NLP config | `core/config.py` |
| 5.3 | Migrate Pydantic to V2 | `@validator` → `@field_validator` |
| 5.4 | Migrate FastAPI lifespan | `on_event` → lifespan |
| 5.5 | Удалить NLP Docker volumes | `docker-compose.yml` |
| 5.6 | Добавить CASCADE DELETE constraints | Миграция Alembic (см. раздел 8.4) |

### Фаза 6: Testing improvements (1-2 дня)

| # | Задача | Описание |
|---|--------|----------|
| 6.1 | Register pytest marks | `pytest.ini` или `conftest.py` |
| 6.2 | Добавить тесты для auth cache clearing | New tests |
| 6.3 | Добавить integration tests для login/logout flow | New tests |
| 6.4 | Настроить coverage reports | CI/CD |

---

## 10. Приложения

### A. Файлы для немедленного исправления

```bash
# Critical files requiring immediate attention
frontend/src/stores/auth.ts           # Cache clearing
frontend/src/hooks/api/useDescriptions.ts  # Hook violation
frontend/src/App.tsx                  # Export queryClient
backend/tests/services/nlp/           # Delete entire directory
frontend/package.json                 # Add fake-indexeddb
```

### B. Команды для исправлений

```bash
# Фаза 1 - Немедленные исправления
cd frontend && npm install -D fake-indexeddb
cd backend && rm -rf tests/services/nlp/
cd backend && rm tests/services/test_*_processor.py
cd backend && rm tests/test_multi_nlp_manager.py
cd backend && ruff check app/ --fix

# Проверка после исправлений
cd backend && python -m pytest tests/ -v --tb=short
cd frontend && npm test
cd frontend && npm run type-check
```

### C. Метрики успеха

| Метрика | До | После |
|---------|-----|-------|
| **DB migrations** | **✅ Applied** | **✅ OK** |
| **Missing CASCADE DELETE** | **5 FK** | **0** |
| Backend test errors | 29 | 0 |
| Frontend test failures | 7 | 0 |
| TypeScript errors | 34+ | 0 |
| Ruff issues | 50 | 0 |
| eslint-disable directives | 35+ | <10 |
| Cache-related bugs | 1 critical | 0 |

---

## Заключение

Проект имеет солидную архитектурную основу, но накопил критический технический долг после миграции с Multi-NLP системы.

### Статус БД (проверено на production):

✅ **База данных синхронизирована:**
- Версия: `add_is_processing_20251220` (последняя)
- Все таблицы присутствуют
- Все колонки соответствуют моделям

⚠️ **Требуется исправление:** 5 FK без CASCADE DELETE

### Приоритеты исправлений:

1. **🔴 CRITICAL (Немедленно):** Исправить критическую проблему с кешем при авторизации
2. **HIGH (Краткосрочно):** Очистить orphan код и тесты, разблокировать CI/CD
3. **MEDIUM (Среднесрочно):** Добавить CASCADE DELETE constraints, улучшить типизацию
4. **LOW (Долгосрочно):** Консолидировать state management, убрать eslint-disable

### Оценка времени:

| Фаза | Время |
|------|-------|
| Фаза 0: ✅ DB OK | ВЫПОЛНЕНО |
| Фаза 1: Critical | 5 часов |
| Фаза 2-6: Остальное | ~2 недели |

---

*Отчёт сгенерирован Claude Opus 4.5*
*Версия: 1.2 (проверено на production сервере 77.246.106.109)*
