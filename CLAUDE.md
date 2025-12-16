# CLAUDE.md

Guidance for Claude Code when working with BookReader AI repository.

## Project Overview

**BookReader AI** - Web application for reading fiction with automatic image generation from book descriptions. Subscription-based monetization (FREE/PREMIUM/ULTIMATE).

**Core Value:** LLM-powered extraction of visual descriptions + AI image generation.

> **NLP REMOVAL (December 2025):** Multi-NLP system (SpaCy, Natasha, Stanza, GLiNER) removed for server optimization. Description extraction now via Google Gemini API (LangExtract). RAM: 10-12 GB → 2-3 GB (-75%), Docker: 2.5 GB → 800 MB (-68%).

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 + TypeScript | UI framework |
| epub.js 0.3.93 | EPUB rendering with CFI navigation |
| Tailwind CSS | Styling |
| TanStack Query | Server state management |
| Zustand | Client state |
| Vite | Build tool |

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI + Python 3.11 | API framework |
| PostgreSQL 15 | Primary database |
| Redis | Caching + task queue |
| Celery | Background processing |
| SQLAlchemy + Alembic | ORM + migrations |

### Description Extraction (UPDATED December 2025)

**Current Architecture:** LLM-Only Mode via Google Gemini API (LangExtract)
- Extracts descriptions on-demand when user opens chapter
- Supports Russian → English translation for image prompts
- Cost: ~$0.02/book
- RAM: ~500 MB (vs 2.2 GB for NLP models)

> **DEPRECATED:** Multi-NLP Ensemble (SpaCy, Natasha, Stanza, GLiNER) removed December 2025.

**Image Generation:** Google Imagen 4 (primary)

### Feature Flags
Database-backed feature control. Key flags:
```
ENABLE_IMAGE_CACHING = True       # Image generation cache
```
Admin API: `GET/POST/PUT/DELETE /api/v1/admin/feature-flags`

## Key Files

### Backend Services
| File | Lines | Purpose |
|------|-------|---------|
| `app/services/book_parser.py` | 925 | EPUB/FB2 parsing + CFI generation |
| `app/services/langextract_processor.py` | 811 | LLM-based description extraction |
| `app/services/imagen_generator.py` | ~300 | Google Imagen 4 image generation |
| `app/services/image_generator.py` | 301 | Image generation orchestration |
| `app/services/feature_flag_manager.py` | 422 | Feature control |

> **REMOVED December 2025:** `multi_nlp_manager.py`, `nlp/` directory, NLP processors

### Frontend Components (December 2025)
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/Reader/EpubReader.tsx` | 573 | epub.js EPUB reader with CFI navigation |
| `src/pages/LibraryPage.tsx` | 739 | Book library + upload management |
| `src/hooks/epub/useDescriptionHighlighting.ts` | 566 | 9 search strategies for highlighting |

### Frontend Caching Services (NEW - December 2025)
| File | Lines | Purpose |
|------|-------|---------|
| `src/services/chapterCache.ts` | ~200 | IndexedDB кэш для глав (descriptions + images), auto-sync |
| `src/services/imageCache.ts` | 482 | IndexedDB offline image cache с auto-cleanup каждые 5 минут |

### TanStack Query Hooks (NEW - December 2025, src/hooks/api/)
| File | Purpose |
|------|---------|
| `queryKeys.ts` | Централизованное управление ключами кэша для всех запросов |
| `useBooks.ts` | Хуки для работы с книгами (list, get, upload) с prefetching |
| `useChapter.ts` | Хуки для глав с интеграцией IndexedDB и offline support |
| `useDescriptions.ts` | Хуки для описаний с кэшированием (LLM extraction) |
| `useImages.ts` | Хуки для генерации и управления изображениями |

### Модульные Компоненты (NEW - December 2025)
| Directory | Компоненты | Purpose |
|-----------|-----------|---------|
| `src/components/Library/` | Header, Stats, Search, BookCard, BookGrid, Pagination | Модульные компоненты библиотеки книг |
| `src/components/Admin/` | Header, Stats, TabNavigation, MultiNLPSettings, ParsingSettings | Модульные компоненты админ-панели |

### Library Hooks (NEW - December 2025)
| File | Purpose |
|------|---------|
| `src/hooks/library/useLibraryFilters.ts` | Фильтрация и статистика книг (сортировка, поиск, пагинация) |

### Core Models
| Model | Key Fields |
|-------|------------|
| `User` | email, subscription_type |
| `Book` | title, author, genre, file_format |
| `ReadingProgress` | reading_location_cfi, scroll_offset_percent |
| `Description` | content, type, confidence_score |
| `GeneratedImage` | image_url, service_used |

## Docker Services

```yaml
services:
  postgres:     PostgreSQL 15.7
  redis:        Cache + task queue
  backend:      FastAPI + NLP models (~2.2GB)
  celery-worker: Background processing
  celery-beat:   Scheduled tasks
  frontend:     Vite + React
```

Production: `docker-compose.lite.yml` (lighter images)

## Development Commands

```bash
# Start development
docker-compose up -d

# Backend tests
cd backend && pytest -v --cov=app

# Frontend tests
cd frontend && npm test

# Type checking
cd frontend && npm run type-check
cd backend && mypy app/

# Database migrations
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"

# View logs
docker-compose logs -f backend celery-worker
```

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost/bookreader
REDIS_URL=redis://localhost:6379
SECRET_KEY=change-in-production

# Optional
GOOGLE_API_KEY=...              # For Gemini/LangExtract
POLLINATIONS_ENABLED=true       # Image generation
YOOKASSA_SHOP_ID=...           # Payments
```

## API Quick Reference

### Core Endpoints
```
POST /api/v1/auth/login          # JWT authentication
POST /api/v1/auth/register       # User registration

GET  /api/v1/books               # List user books
POST /api/v1/books/upload        # Upload EPUB/FB2
GET  /api/v1/books/{id}          # Book details + progress
PUT  /api/v1/books/{id}/progress # Update reading position

GET  /api/v1/chapters/{id}       # Chapter content
GET  /api/v1/descriptions/{chapter_id}  # Extracted descriptions
POST /api/v1/images/generate/{description_id}  # Generate image
```

### Admin Endpoints
```
GET  /api/v1/admin/stats              # System statistics
GET  /api/v1/admin/feature-flags      # Feature flags management
GET  /api/v1/admin/multi-nlp-settings # NLP processor config
POST /api/v1/admin/parsing/{book_id}  # Trigger manual parsing
```

## Database Notes

**Enums stored as VARCHAR:**
- `books.genre` → String(50), not Enum
- `books.file_format` → String(10)
- `generated_images.status` → String(20)

**CFI Fields (EPUB position tracking):**
- `reading_progress.reading_location_cfi` - String(500)
- `reading_progress.scroll_offset_percent` - Float (0-100)

## Code Standards

### Commits
```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
```

### Documentation
- All functions require docstrings
- React components require JSDoc
- Update docs after significant changes

### Type Safety
- Backend: 95%+ type coverage with Pydantic schemas
- Frontend: TypeScript strict mode
- Pre-commit hooks: mypy, ruff, black, eslint

## File Structure (Simplified, Updated December 2025)

```
fancai-vibe-hackathon/
├── frontend/
│   ├── src/components/
│   │   ├── Reader/               # EPUB reader components (EpubReader, etc.)
│   │   ├── Library/              # Модульные компоненты библиотеки (6 файлов)
│   │   └── Admin/                # Модульные компоненты админ-панели (5 файлов)
│   ├── src/hooks/
│   │   ├── api/                  # TanStack Query хуки (queryKeys, useBooks, useChapter, useDescriptions, useImages)
│   │   ├── epub/                 # EPUB reader hooks (CFI, progress, highlighting)
│   │   └── library/              # Library hooks (useLibraryFilters)
│   ├── src/services/             # API clients + caching (imageCache, chapterCache)
│   └── src/pages/                # Page components (LibraryPage, ReaderPage, etc.)
├── backend/
│   ├── app/core/                 # Config, DB, exceptions
│   ├── app/models/               # SQLAlchemy models
│   ├── app/routers/              # API endpoints
│   │   ├── admin/                # Admin endpoints (modular)
│   │   └── books/                # Book endpoints (modular)
│   └── app/services/             # Business logic
│       ├── nlp/                  # NLP strategies + components
│       └── advanced_parser/      # Multi-stage parser
├── docs/                         # Documentation (Diataxis framework)
│   ├── guides/                   # How-to guides
│   ├── reference/                # API, DB schemas
│   ├── explanations/             # Architecture
│   └── reports/                  # Session reports (archived)
└── docker-compose.yml            # Development stack
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Parser quality | >70% relevant descriptions |
| Image generation | <30 seconds |
| Page load | <2 seconds |
| Uptime | >99% |

## Current Focus (December 2025)

### Completed (December 2025)
1. **Frontend Architecture Refactoring** - TanStack Query hooks (api/), modular components (Library/, Admin/), caching services
   - chapterCache.ts - IndexedDB для описаний и изображений глав
   - imageCache.ts - Auto-cleanup каждые 5 минут
   - 5 TanStack Query хуков с полной типизацией
   - 6 компонентов Library (Header, Stats, Search, BookCard, BookGrid, Pagination)
   - 5 компонентов Admin (Header, Stats, TabNavigation, MultiNLPSettings, ParsingSettings)

2. **Image URL Handling** - Fixed inline content-disposition for proper browser display
   - Persistent storage для сгенерированных изображений
   - Correct URL normalization (не срезать /api/v1 prefix)

### In Progress
1. **LLM Migration** - Evaluating Gemini-based parsing vs Multi-NLP
2. **Description Highlighting** - 9-strategy search for accuracy (already implemented)
3. **Reading Progress** - CFI + scroll offset for precise restoration
4. **Offline Support** - Full offline reading with IndexedDB synchronization

## Frontend Architecture Details (December 2025)

### Caching Strategy
- **TanStack Query (v5)** - Server state management с автоматическим кэшированием
  - queryKeys.ts - Централизованный реестр всех ключей для type-safe кэша
  - Stale-while-revalidate паттерн для оптимального UX
  - Background refetch при фокусе окна

- **IndexedDB** - Локальное хранилище для offline доступа
  - chapterCache.ts - Кэширование содержимого глав и описаний
  - imageCache.ts - Кэширование сгенерированных изображений
  - Auto-cleanup - Удаление старых данных каждые 5 минут

### Component Organization
- **Library Components** - Модульная архитектура для страницы библиотеки
  - Header - Поиск и сортировка
  - Stats - Статистика по книгам (всего, в процессе, завершено)
  - Search - Интеграция с useLibraryFilters
  - BookCard - Карточка книги с метаданными
  - BookGrid - Сетка книг с пагинацией
  - Pagination - Навигация по страницам

- **Admin Components** - Модульная архитектура для админ-панели
  - Header - Название и описание раздела
  - Stats - Системная статистика
  - TabNavigation - Переключение между вкладками
  - MultiNLPSettings - Настройки NLP процессоров
  - ParsingSettings - Настройки парсинга и очереди

### Data Flow (TanStack Query)
```
Component → useBooks/useChapter/useDescriptions/useImages
    ↓
TanStack Query (queryKeys for caching)
    ↓
IndexedDB (if offline) / API (online)
    ↓
Auto-refetch on focus/interval
    ↓
Automatic invalidation on mutations
```

## Quick Links

| Resource | Path |
|----------|------|
| API Documentation | `/docs` (Swagger UI) |
| Architecture | `docs/explanations/architecture/` |
| NLP System | `docs/explanations/architecture/nlp/` |
| Deployment | `docs/guides/deployment/` |
| Testing | `docs/guides/testing/` |
| Reports | `docs/reports/` |

---

For detailed documentation, see `/docs/README.md`.
