# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BookReader AI** - Веб-приложение для чтения художественной литературы с автоматической генерацией изображений по описаниям из книг с подписочной моделью монетизации.

## Technology Stack

### Frontend
- **React 18+** с **TypeScript**
- **epub.js 0.3.93** - EPUB парсинг и рендеринг (NEW: октябрь 2025)
- **react-reader 2.0.15** - React wrapper для epub.js (NEW: октябрь 2025)
- **Tailwind CSS** для стилизации
- **React Query/TanStack Query** для управления состоянием сервера
- **Zustand** для клиентского состояния
- **Socket.io-client** для real-time функций

### Backend
- **Python 3.11+** с **FastAPI**
- **PostgreSQL 15+** для основной БД
- **Redis** для кэширования и очередей задач
- **Celery** для асинхронных задач
- **SQLAlchemy** ORM с **Alembic** для миграций

### NLP & AI
- **Advanced Multi-NLP Manager** - координация 3 процессоров
  - **SpaCy** (ru_core_news_lg) - entity recognition, вес 1.0
  - **Natasha** - русская морфология и NER, вес 1.2 (специализация)
  - **Stanza** (ru) - dependency parsing, вес 0.8

- **5 режимов обработки**:
  - SINGLE - один процессор (быстро)
  - PARALLEL - параллельная обработка (максимальное покрытие)
  - SEQUENTIAL - последовательная обработка
  - ENSEMBLE - voting с consensus алгоритмом (максимальное качество)
  - ADAPTIVE - автоматический выбор режима (интеллектуально)

- **Ensemble Voting**:
  - Weighted consensus: SpaCy (1.0), Natasha (0.8), Stanza (0.7)
  - Consensus threshold: 0.6 (60%)
  - Context enrichment + deduplication

- **pollinations.ai** (основной сервис генерации изображений)
- **OpenAI DALL-E, Midjourney, Stable Diffusion** (опциональные)

## Common Development Tasks

### Project Setup
```bash
# Клонирование и запуск
git clone <repository-url>
cd fancai-vibe-hackathon
docker-compose up -d

# Установка зависимостей
cd backend && pip install -r requirements.txt
cd frontend && npm install
```

### Development Commands
```bash
# Запуск в режиме разработки
docker-compose -f docker-compose.dev.yml up

# Backend тесты
cd backend && pytest -v --cov=app

# Frontend тесты
cd frontend && npm test

# Линтинг
cd backend && ruff check . && black --check .
cd frontend && npm run lint

# Типы (TypeScript + Python) - NEW Phase 3
cd frontend && npm run type-check
cd backend && mypy app/ --strict  # NEW: MyPy strict type checking

# Type checking только core modules (100% coverage required)
cd backend && mypy app/core/ --disallow-any-expr

# Pre-commit hooks (NEW Phase 3)
pre-commit install  # Install hooks
pre-commit run --all-files  # Run all checks

# База данных миграции
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"

# CFI и epub.js разработка
# Тестирование CFI генерации
cd backend && python -c "from app.services.book_parser import BookParser; parser = BookParser(); # test CFI"

# Проверка reading_progress с CFI
curl -X GET http://localhost:8000/api/v1/books/{book_id}/progress

# Тестирование epub.js компонента (frontend)
cd frontend && npm run dev  # проверить EpubReader.tsx
```

### Multi-NLP система и парсинг
```bash
# Установка всех NLP моделей
python -m spacy download ru_core_news_lg  # SpaCy
pip install natasha  # Natasha
pip install stanza && python -c "import stanza; stanza.download('ru')"  # Stanza

# Тестирование Multi-NLP системы
cd backend && python -c "from app.services.multi_nlp_manager import multi_nlp_manager; import asyncio; asyncio.run(multi_nlp_manager.get_processor_status())"

# Проверка статуса всех процессоров
curl -X GET http://localhost:8000/api/v1/admin/multi-nlp-settings/status

# Обновление настроек через админ API
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/spacy -d '{"weight": 1.0, "threshold": 0.3}'
```

## Critical Development Requirements

### Documentation Standards
**ОБЯЗАТЕЛЬНО:** Каждое изменение в коде должно сопровождаться обновлением документации!

#### После каждой реализации функциональности:
1. ✅ Обновить `README.md` с информацией о новой функции
2. ✅ Обновить `docs/development/development-plan.md` - отметить выполненные задачи
3. ✅ Обновить `docs/development/development-calendar.md` - зафиксировать даты
4. ✅ Добавить в `docs/development/changelog.md` - детально описать изменения
5. ✅ Обновить `docs/development/current-status.md` - текущее состояние проекта
6. ✅ Документировать новый код - docstrings, комментарии, README модулей

### Code Documentation Standards
```python
# Все функции должны иметь docstrings
def extract_descriptions(text: str, description_type: str) -> List[Description]:
    """
    Извлекает описания определенного типа из текста.

    Args:
        text: Исходный текст для анализа
        description_type: Тип описаний ('location', 'character', 'atmosphere')

    Returns:
        Список найденных описаний с метаданными

    Example:
        >>> descriptions = extract_descriptions(chapter_text, 'location')
        >>> print(f"Найдено {len(descriptions)} описаний локаций")
    """
```

```typescript
// React компоненты должны иметь JSDoc комментарии
/**
 * Компонент читалки книг с поддержкой изображений
 *
 * @param book - Объект книги для чтения
 * @param currentPage - Текущая страница
 * @param onPageChange - Callback при смене страницы
 */
```

### Git Commit Standards & Best Practices

#### Commit Message Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Типы коммитов:**
- `feat`: новая функциональность
- `fix`: исправление бага
- `docs`: изменения в документации
- `style`: изменения в стилях (не влияющие на логику)
- `refactor`: рефакторинг кода
- `test`: добавление или изменение тестов
- `chore`: вспомогательные изменения (build, ci, deps)

**Примеры качественных коммитов:**
```bash
feat(parser): добавлен парсер EPUB файлов

- Реализован класс EpubParser с методом extract_content()
- Добавлена поддержка CSS стилей и изображений
- Добавлены unit тесты для всех публичных методов
- Обновлена документация: docs/reference/components/parser/book-parser.md

Closes #123
Docs: docs/reference/components/parser/book-parser.md

fix(reader): исправлена пагинация на мобильных устройствах

- Устранена проблема с переполнением текста на экранах <768px
- Оптимизирован расчет высоты страницы для разных шрифтов
- Добавлены responsive тесты

Fixes #456

docs: обновлен план разработки и календарь

- Отмечены как выполненные задачи парсера EPUB
- Добавлены новые задачи для Phase 2
- Обновлены временные оценки

[skip ci]
```

#### Когда коммитить:
✅ **Коммитить нужно:**
- После завершения логически завершенной функции
- После исправления бага с тестами
- После обновления документации
- Перед переключением на другую задачу
- В конце рабочего дня (WIP коммиты)

❌ **НЕ коммитить:**
- Код с failing тестами (кроме WIP)
- Код без документации для новой функциональности
- Большие изменения в одном коммите (>500 строк)
- Конфиденциальные данные (API ключи, пароли)

#### Pre-commit проверки:
```bash
# Автоматические проверки перед коммитом
pre-commit install

# Проверки включают:
- Линтинг кода (ruff, eslint)
- Форматирование (black, prettier)
- Типы (mypy, tsc)
- Тесты (pytest, jest) - быстрые только
- Проверка документации
- Сканирование на секреты
```

### File Structure (Updated: Phase 3 - 25.10.2025)
```
fancai-vibe-hackathon/
├── frontend/                 # React приложение
│   ├── src/components/      # React компоненты
│   │   └── Reader/
│   │       └── EpubReader.tsx  # ✅ epub.js компонент (835 строк, октябрь 2025)
│   ├── src/hooks/          # Custom hooks
│   ├── src/stores/         # Zustand stores
│   └── src/types/          # TypeScript типы
├── backend/                 # FastAPI приложение
│   ├── app/core/           # ✅ REFACTORED (Phase 3) - Core utilities
│   │   ├── config.py       # ✅ Настройки приложения
│   │   ├── database.py     # ✅ Асинхронная база данных
│   │   ├── exceptions.py   # ✅ NEW: 35+ custom exception classes (DRY)
│   │   └── dependencies.py # ✅ NEW: 10 reusable FastAPI dependencies
│   ├── app/models/         # SQLAlchemy модели
│   │   ├── user.py         # ✅ User, Subscription модели
│   │   ├── book.py         # ✅ Book, ReadingProgress модели
│   │   │                   # NEW: reading_location_cfi, scroll_offset_percent (октябрь 2025)
│   │   │                   # NEW: get_reading_progress_percent() метод с CFI логикой
│   │   ├── chapter.py      # ✅ Chapter модель
│   │   ├── description.py  # ✅ Description модель с типами
│   │   ├── image.py        # ✅ GeneratedImage модель
│   │   └── admin_settings.py # ORPHANED - модель существует, таблица УДАЛЕНА!
│   ├── app/routers/        # ✅ REFACTORED (Phase 3) - Modular API routes
│   │   ├── admin/          # ✅ NEW: Admin router модули (6 modules, 904→485 lines)
│   │   │   ├── __init__.py
│   │   │   ├── stats.py           # System statistics (2 endpoints)
│   │   │   ├── nlp_settings.py    # Multi-NLP config (5 endpoints)
│   │   │   ├── parsing.py         # Book parsing management (3 endpoints)
│   │   │   ├── images.py          # Image generation (3 endpoints)
│   │   │   ├── system.py          # Health & maintenance (2 endpoints)
│   │   │   └── users.py           # User management (2 endpoints)
│   │   ├── books/          # ✅ NEW: Books router модули (3 modules, 799 lines refactored)
│   │   │   ├── __init__.py
│   │   │   ├── crud.py            # CRUD operations (8 endpoints)
│   │   │   ├── validation.py      # Validation utilities
│   │   │   └── processing.py      # Processing & progress (5 endpoints)
│   │   ├── users.py        # ✅ Пользовательские endpoints
│   │   └── nlp.py          # ✅ NLP тестирование и обработка
│   ├── app/services/       # ✅ REFACTORED (Phase 3) - Business logic
│   │   ├── book/           # ✅ NEW: Book services модули (4 services, SRP applied)
│   │   │   ├── __init__.py
│   │   │   ├── book_service.py             # CRUD operations (~250 lines)
│   │   │   ├── book_progress_service.py    # Reading progress (~180 lines)
│   │   │   ├── book_statistics_service.py  # Analytics (~150 lines)
│   │   │   └── book_parsing_service.py     # Parsing coordination (~200 lines)
│   │   ├── book_parser.py  # ✅ EPUB/FB2 парсер (796 строк) + CFI generation
│   │   ├── multi_nlp_manager.py # ✅ Multi-NLP координатор (627 строк)
│   │   └── nlp_processor.py # ✅ NLP обработка с приоритетами
│   └── docs/               # ✅ NEW: Backend documentation
│       └── TYPE_CHECKING.md # ✅ NEW: MyPy strict mode guide (~30KB)
├── docs/                   # ✅ REORGANIZED (Nov 2025) - Diátaxis framework
│   ├── README.md           # Central navigation hub
│   ├── guides/             # 📘 Tutorials & How-to guides
│   │   ├── getting-started/  # Installation, quick start
│   │   ├── development/      # Dev environment, testing
│   │   ├── deployment/       # Production deployment
│   │   ├── agents/           # Claude Code agents usage
│   │   └── testing/          # Testing guides
│   ├── reference/          # 📖 Technical specifications
│   │   ├── api/              # REST API documentation
│   │   ├── database/         # Database schema, migrations
│   │   ├── components/       # Component documentation
│   │   ├── nlp/              # Multi-NLP system reference
│   │   └── cli/              # CLI commands reference
│   ├── explanations/       # 🎓 Concepts & architecture
│   │   ├── architecture/     # System architecture
│   │   ├── concepts/         # CFI, EPUB integration
│   │   ├── design-decisions/ # Technology choices
│   │   └── agents-system/    # Agents architecture
│   ├── operations/         # 🔧 Deployment & maintenance
│   │   ├── deployment/       # Deployment procedures
│   │   ├── docker/           # Docker operations
│   │   ├── backup/           # Backup procedures
│   │   └── monitoring/       # Monitoring setup
│   ├── development/        # 👨‍💻 Development process
│   │   ├── planning/         # Development plan, calendar
│   │   ├── changelog/        # Version history
│   │   ├── status/           # Current status
│   │   └── performance/      # Optimization plans
│   ├── refactoring/        # 🔨 Refactoring documentation
│   ├── ci-cd/              # 🔄 CI/CD workflows
│   ├── security/           # 🔐 Security documentation
│   ├── reports/            # 📊 Archived temporal reports
│   │   └── archive/2025-Q4/  # Q4 2025 reports archive
│   └── ru/                 # 🇷🇺 Russian translations (mirror structure)
├── .github/                # ✅ NEW: CI/CD workflows
│   └── workflows/
│       └── type-check.yml  # ✅ NEW: MyPy type checking в CI/CD
├── .pre-commit-config.yaml # ✅ NEW: Pre-commit hooks (mypy, ruff, black)
└── scripts/                # Вспомогательные скрипты
```

### Phase 3 Refactoring Highlights (25.10.2025)

**Modularization:**
- Admin Router: 904 lines → 6 modules (46% size reduction)
- Books Router: 799 lines → 3 modules (clean separation)
- BookService: 714 lines → 4 services (68% avg size reduction)

**DRY Principle:**
- Custom Exceptions: 35+ classes in `app/core/exceptions.py`
- Reusable Dependencies: 10 dependencies in `app/core/dependencies.py`
- Eliminated: ~200-300 lines duplicate error handling

**Type Safety:**
- Type Coverage: 70% → 95%+ (100% in core modules)
- MyPy strict mode enabled
- CI/CD type checking
- Pre-commit hooks

## Architecture Overview

### Core Components
1. **Book Processing Pipeline:**
   - EPUB/FB2 парсер → Содержимое глав → Парсер описаний → Очередь генерации изображений

2. **Advanced Multi-NLP System (КРИТИЧЕСКИ ВАЖНО):**
   - Три полноценных процессора: SpaCy (entity recognition), Natasha (русские имена), Stanza (сложный синтаксис)
   - Пять режимов обработки с автоматическим выбором оптимального
   - Ensemble voting с consensus алгоритмом и весами процессоров
   - Контекстное обогащение и deduplication описаний
   - **Прорыв в качестве**: 2171 описание за 4 секунды

3. **Image Generation:**
   - pollinations.ai (основной, бесплатный)
   - Промпт-инжиниринг по жанрам и типам описаний
   - Кэширование и дедупликация изображений

4. **Reading Interface:**
   - epub.js + react-reader для профессионального EPUB рендеринга
   - CFI (Canonical Fragment Identifier) для точной навигации
   - Модальные окна для изображений по клику на описания
   - Офлайн-режим с Service Worker

### Database Schema (PostgreSQL)

#### ВАЖНОЕ ЗАМЕЧАНИЕ о типах данных:
**Enums vs VARCHAR:**
Модели SQLAlchemy ОПРЕДЕЛЯЮТ Enums (BookGenre, BookFormat, ImageService, ImageStatus),
НО в Column definitions используется String, а НЕ Enum!

Примеры:
- `books.genre` - String(50), а НЕ Enum(BookGenre)
- `books.file_format` - String(10), а НЕ Enum(BookFormat)
- `generated_images.service_used` - String(50), а НЕ Enum(ImageService)
- `generated_images.status` - String(20), а НЕ Enum(ImageStatus)

**JSON vs JSONB:**
Для PostgreSQL используется JSON тип, НО рекомендуется JSONB для:
- `books.book_metadata` - JSON (рекомендуется JSONB)
- `generated_images.generation_parameters` - JSON (рекомендуется JSONB)
- `generated_images.moderation_result` - JSON (рекомендуется JSONB)

**Новые поля (октябрь 2025):**
- `reading_progress.reading_location_cfi` - String(500) - CFI для epub.js
- `reading_progress.scroll_offset_percent` - Float - точный scroll 0-100%

```sql
-- Основные таблицы
Users, Books, Chapters, Descriptions, Generated_Images

-- Пользовательские данные
Bookmarks, Highlights, Reading_Progress, Reading_Sessions

-- Административные
Subscriptions, Payment_History, System_Logs
-- AdminSettings - модель существует в коде, но таблица УДАЛЕНА из БД!
```

### Key Performance Requirements
- **Парсер:** >70% релевантных описаний для генерации
- **Генерация:** <30 секунд среднее время
- **Читалка:** <2 секунды загрузка страниц
- **Uptime:** >99% доступность сервиса

## Special Notes

### Critical Success Factors
1. **Качество парсера описаний** - основная ценность проекта
2. **Mobile-first подход** - приоритет удобства на мобильных
3. **Документирование всех изменений** - обязательное требование
4. **Подписочная модель** - FREE → PREMIUM → ULTIMATE планы

### Development Phases
- **Phase 0 (Initialization):** ✅ Завершено - инфраструктура и документация
- **Phase 1 (MVP):** ✅ ЗАВЕРШЕНО (95% завершено) - базовая функциональность РАБОТАЕТ
  - ✅ Модели базы данных
  - ✅ Парсер книг EPUB/FB2
  - ✅ NLP процессор с приоритизацией
  - ✅ API для управления книгами (ИСПРАВЛЕН UUID баг)
  - ✅ Система аутентификации JWT
  - ✅ Генерация изображений pollinations.ai
  - ✅ Frontend интерфейс React+TypeScript
  - ✅ Автоматический парсинг с прогресс-индикатором
  - ✅ Production deployment готов
- **Phase 2:** 6-8 недель - улучшения и оптимизации  
- **Phase 3:** 4-6 недель - масштабирование и ML улучшения

### Environment Variables Required
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/bookreader
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=sk-... (опционально)
POLLINATIONS_ENABLED=true

# Payment Systems
YOOKASSA_SHOP_ID=123456
YOOKASSA_SECRET_KEY=test_...

# App Settings
SECRET_KEY=change-in-production
DEBUG=false
```

## Quick Reference

### Frequently Used Commands
```bash
# Быстрый перезапуск разработки
docker-compose restart backend frontend

# Просмотр логов
docker-compose logs -f backend
docker-compose logs -f celery-worker

# Очистка Redis кэша
docker-compose exec redis redis-cli FLUSHALL

# Выполнение миграций
docker-compose exec backend alembic upgrade head

# Тестирование парсера на образце
docker-compose exec backend python scripts/test_parser.py --sample

# Генерация API документации
docker-compose exec backend python scripts/generate_docs.py
```

### Important File Locations

**Code:**
- **CFI Reading System:** `backend/app/models/book.py` (ReadingProgress модель)
- **epub.js Component:** `frontend/src/components/Reader/EpubReader.tsx` (835 строк)
- **Multi-NLP Manager:** `backend/app/services/multi_nlp_manager.py` (627 строк)
- **Admin multi-nlp settings:** `backend/app/routers/admin.py` (5 endpoints)
- **Book Parser with CFI:** `backend/app/services/book_parser.py` (796 строк)
- **Основной промпт:** `prompts.md`
- **Конфигурация Docker:** `docker-compose.yml`

**Documentation (Updated Structure - Nov 2025):**
- **Документация центр:** `docs/README.md` (навигация по Diátaxis framework)
- **План разработки:** `docs/development/planning/development-plan.md`
- **Календарь разработки:** `docs/development/planning/development-calendar.md`
- **Changelog:** `docs/development/changelog/2025.md`
- **Текущий статус:** `docs/development/status/current-status.md`
- **API документация:** `docs/reference/api/overview.md`
- **Схема БД:** `docs/reference/database/schema.md`
- **Системная архитектура:** `docs/explanations/architecture/system-architecture.md`
- **Multi-NLP архитектура:** `docs/explanations/architecture/nlp/architecture.md`
- **Production deployment:** `docs/guides/deployment/production-deployment.md`
- **Docker setup:** `docs/operations/docker/setup.md`
- **Testing guide:** `docs/guides/testing/testing-guide.md`
- **Agents guide:** `docs/guides/agents/quickstart.md`
