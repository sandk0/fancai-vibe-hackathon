# CLAUDE.md

Guidance for Claude Code when working with fancai repository.

## Project Overview

**fancai** - Web application for reading fiction with automatic image generation from book descriptions. Subscription-based monetization (FREE/PREMIUM/ULTIMATE).

**Core Value:** LLM-powered extraction of visual descriptions + AI image generation.

> **NLP REMOVAL (December 2025):** Multi-NLP system (SpaCy, Natasha, Stanza, GLiNER) removed for server optimization. Description extraction now via Google Gemini API. RAM: 10-12 GB -> 2-3 GB (-75%), Docker: 2.5 GB -> 800 MB (-68%).

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 + TypeScript 5.7 | UI framework |
| epub.js 0.3.93 | EPUB rendering with CFI navigation |
| Tailwind CSS 3.4 | Styling |
| TanStack Query 5.90 | Server state management |
| Zustand 5 | Client state |
| Vite 6 | Build tool |

### Backend
| Technology | Purpose |
|------------|---------|
| FastAPI 0.125 + Python 3.11 | API framework |
| PostgreSQL 15 | Primary database |
| Redis 5.2 | Caching + task queue |
| Celery 5.4 | Background processing |
| SQLAlchemy 2.0.45 + Alembic 1.14 | ORM + migrations |

### Description Extraction (December 2025)

**Current Architecture:** LLM-Only Mode via Google Gemini 3.0 Flash API
- Extracts descriptions on-demand when user opens chapter
- Supports Russian -> English translation for image prompts
- Cost: ~$0.02/book (Gemini 3.0 Flash: $0.50/1M input, $3/1M output tokens)
- RAM: ~500 MB (vs 2.2 GB for NLP models)

> **DEPRECATED:** Multi-NLP Ensemble (SpaCy, Natasha, Stanza, GLiNER) removed December 2025.

**Image Generation:** Google Imagen 4 GA (imagen-4.0-generate-001, $0.04/image)

### Feature Flags
Database-backed feature control. Key flags:
```
ENABLE_IMAGE_CACHING = True       # Image generation cache
```
Admin API: `GET/POST/PUT/DELETE /api/v1/admin/feature-flags`

## Key Files

### Backend Services (Total: 8,400+ lines in 17+ services)
| File | Lines | Purpose |
|------|-------|---------|
| `app/services/book_parser.py` | 925 | EPUB/FB2 parsing + CFI generation |
| `app/services/langextract_processor.py` | 815 | LLM-based description extraction |
| `app/services/gemini_extractor.py` | 661 | Direct Gemini API for extraction |
| `app/services/imagen_generator.py` | 644 | Google Imagen 4 image generation |
| `app/core/retry.py` | 515 | **NEW:** Exponential backoff decorators (tenacity) |
| `app/services/reading_session_cache.py` | 454 | Redis session caching |
| `app/services/settings_manager.py` | 422 | Redis-backed settings |
| `app/services/llm_description_enricher.py` | 413 | Description post-processing |
| `app/services/user_statistics_service.py` | 407 | Reading analytics |
| `app/services/reading_session_service.py` | 379 | Optimized DB queries |
| `app/services/feature_flag_manager.py` | 378 | Feature control |
| `app/services/auth_service.py` | 373 | JWT authentication |
| `app/services/parsing_manager.py` | 319 | Global parsing queue |
| `app/services/image_generator.py` | 283 | Image generation orchestration |
| `app/services/vless_http_client.py` | 255 | Proxy-aware HTTP client |
| `app/services/token_blacklist.py` | 156 | **NEW:** JWT token revocation (Redis) |
| `app/services/book/` | 1,028 | Book CRUD (4 services) |

> **REMOVED December 2025:** `multi_nlp_manager.py`, `nlp/` directory, NLP processors

### Frontend Components (December 2025)
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/Reader/EpubReader.tsx` | 573 | epub.js EPUB reader with CFI navigation |
| `src/pages/LibraryPage.tsx` | 195 | Book library (refactored from 739) |
| `src/hooks/epub/useDescriptionHighlighting.ts` | 566 | 9 search strategies for highlighting |
| `src/utils/retryWithBackoff.ts` | 442 | **NEW:** Exponential backoff for API calls |
| `src/services/syncQueue.ts` | 312 | **NEW:** Offline sync queue (localStorage) |
| `src/components/Reader/PositionConflictDialog.tsx` | 123 | **NEW:** Reading position conflict resolution |
| `src/hooks/useOnlineStatus.ts` | 87 | **NEW:** Online/offline status detection |

### Frontend Caching Services
| File | Lines | Purpose |
|------|-------|---------|
| `src/services/chapterCache.ts` | ~600 | IndexedDB cache for chapters (descriptions + images) |
| `src/services/imageCache.ts` | ~500 | IndexedDB offline image cache with auto-cleanup |
| `src/services/syncQueue.ts` | 312 | **NEW:** Offline operation queue with auto-sync |

### TanStack Query Hooks (src/hooks/api/)
| File | Purpose |
|------|---------|
| `queryKeys.ts` | Centralized cache key management |
| `useBooks.ts` | Book list, get, upload with prefetching |
| `useChapter.ts` | Chapters with IndexedDB + offline support |
| `useDescriptions.ts` | Descriptions with LLM extraction caching |
| `useImages.ts` | Image generation and management |

### Modular Components
| Directory | Components | Purpose |
|-----------|-----------|---------|
| `src/components/Library/` | Header, Stats, Search, BookCard, BookGrid, Pagination | Library page modules |
| `src/components/Admin/` | Header, Stats, TabNavigation, MultiNLPSettings, ParsingSettings | Admin panel modules |

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
  backend:      FastAPI (LLM-only, ~800MB image)
  celery-worker: Background processing
  celery-beat:   Scheduled tasks
  frontend:     Vite + React
```

Production: `docker-compose.lite.yml` (optimized images)

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
GOOGLE_API_KEY=...              # For Gemini + Imagen
POLLINATIONS_ENABLED=true       # Fallback image generation
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
POST /api/v1/admin/parsing/{book_id}  # Trigger manual parsing
```

## Database Notes

**Enums stored as VARCHAR:**
- `books.genre` -> String(50), not Enum
- `books.file_format` -> String(10)
- `generated_images.status` -> String(20)

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

## File Structure (December 2025)

```
fancai-vibe-hackathon/
├── frontend/
│   ├── src/components/
│   │   ├── Reader/               # EPUB reader components (14 files)
│   │   │   └── PositionConflictDialog.tsx  # NEW: Sync conflict UI
│   │   ├── Library/              # Modular library components (6 files)
│   │   ├── Admin/                # Modular admin components (5 files)
│   │   └── UI/                   # Shared UI components (12 files)
│   ├── src/hooks/
│   │   ├── api/                  # TanStack Query hooks (5 files + tests)
│   │   ├── epub/                 # EPUB reader hooks (17 files + tests)
│   │   ├── reader/               # Reader business logic (7 files)
│   │   ├── library/              # Library filters (1 file)
│   │   ├── useOnlineStatus.ts    # NEW: Online/offline detection
│   │   └── __tests__/            # Hook tests
│   ├── src/services/             # API clients + caching (4 files)
│   │   └── syncQueue.ts          # NEW: Offline sync queue
│   ├── src/utils/
│   │   └── retryWithBackoff.ts   # NEW: Exponential backoff
│   └── src/pages/                # Page components (11 files)
├── backend/
│   ├── app/core/                 # Config, DB, exceptions
│   │   └── retry.py              # NEW: Retry decorators (tenacity)
│   ├── app/models/               # SQLAlchemy models (9 files)
│   ├── app/routers/              # API endpoints
│   │   ├── admin/                # Admin endpoints (8 modules)
│   │   └── books/                # Book endpoints (3 modules)
│   ├── app/services/             # Business logic (17+ services)
│   │   ├── book/                 # Book CRUD services (4 files)
│   │   └── token_blacklist.py    # NEW: JWT revocation
│   └── tests/
│       ├── services/             # Service unit tests (15+ files)
│       └── integration/          # NEW: Integration tests (8 files)
├── docs/                         # Documentation (Diataxis framework)
│   ├── guides/                   # How-to guides (22 files)
│   ├── reference/                # API, DB schemas (21 files)
│   ├── explanations/             # Architecture (14 files)
│   └── reports/                  # Session reports (139+ files)
└── docker-compose.yml            # Development stack
```

## Performance Requirements

| Metric | Target |
|--------|--------|
| Parser quality | >70% relevant descriptions |
| Image generation | <30 seconds |
| Page load | <2 seconds |
| Uptime | >99% |

## Current State (December 2025)

### Completed Improvement Phases
1. **P0 Hotfix** - Critical bug fixes and stability improvements
2. **P1 Security** - JWT token blacklist, secure token revocation
3. **P2 Stability** - Exponential backoff retry, error handling improvements
4. **P3 Comprehensive** - Offline sync queue, position conflict resolution, integration tests

### Completed Milestones
1. **LLM Migration** - Gemini API for description extraction (replacing Multi-NLP)
2. **Frontend Refactoring** - TanStack Query, modular components, IndexedDB caching
3. **Image Generation** - Google Imagen 4 with offline cache
4. **Performance** - 75% RAM reduction, 68% Docker image reduction
5. **Resilience** - Retry mechanisms with exponential backoff (backend + frontend)
6. **Security** - JWT blacklist for token revocation on logout
7. **Offline-First** - Sync queue for offline operations, online status detection
8. **Test Coverage** - 43 backend tests (8 integration), 18 frontend tests

### Active Features
- Description extraction via Gemini Flash
- Image generation via Imagen 4
- CFI-based reading progress
- 9-strategy description highlighting
- Offline support with IndexedDB
- **NEW:** Exponential backoff retry (API calls, image generation, LLM)
- **NEW:** JWT token blacklist (secure logout)
- **NEW:** Offline sync queue (progress, bookmarks, highlights)
- **NEW:** Position conflict resolution dialog

## Frontend Architecture (December 2025)

### Caching Strategy
- **TanStack Query (v5)** - Server state with auto-invalidation
- **IndexedDB** - Offline storage (chapterCache, imageCache)
- **Stale-while-revalidate** - Optimal UX pattern

### Data Flow
```
Component -> TanStack Query hooks
    |
TanStack Query (queryKeys for caching)
    |
IndexedDB (offline) / API (online)
    |
Auto-refetch on focus/interval
```

## Quick Links

| Resource | Path |
|----------|------|
| API Documentation | `/docs` (Swagger UI) |
| Architecture | `docs/explanations/architecture/` |
| Deployment | `docs/guides/deployment/` |
| Testing | `docs/guides/testing/` |
| Reports | `docs/reports/` |

---

For detailed documentation, see `/docs/README.md`.
