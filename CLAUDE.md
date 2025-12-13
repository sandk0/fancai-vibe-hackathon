# CLAUDE.md

Guidance for Claude Code when working with BookReader AI repository.

## Project Overview

**BookReader AI** - Web application for reading fiction with automatic image generation from book descriptions. Subscription-based monetization (FREE/PREMIUM/ULTIMATE).

**Core Value:** NLP-powered extraction of visual descriptions + AI image generation.

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

### NLP System (Description Extraction)

**Current Architecture:** Multi-NLP Ensemble (4 processors)

| Processor | Model | Weight | Specialization |
|-----------|-------|--------|----------------|
| SpaCy | ru_core_news_lg | 1.0 | Entity recognition |
| Natasha | - | 1.2 | Russian morphology, NER |
| GLiNER | gliner_medium-v2.1 | 1.0 | Zero-shot NER |
| Stanza | ru | 0.8 | Dependency parsing |

**Alternative (Experimental):** LLM-Only Mode via Google Gemini API
- Feature flag: `USE_LANGEXTRACT_PRIMARY=true`
- Lighter: ~500MB vs 2.2GB models
- Cost: ~$0.02/book

**Image Generation:** pollinations.ai (primary, free)

### Feature Flags
Database-backed feature control. Key flags:
```
USE_NEW_NLP_ARCHITECTURE = True   # Multi-NLP ensemble
USE_LANGEXTRACT_PRIMARY = False   # LLM parsing (experimental)
USE_ADVANCED_PARSER = False       # Advanced multi-stage parser
ENABLE_IMAGE_CACHING = True       # Image generation cache
```
Admin API: `GET/POST/PUT/DELETE /api/v1/admin/feature-flags`

## Key Files

### Backend Services
| File | Lines | Purpose |
|------|-------|---------|
| `app/services/book_parser.py` | 925 | EPUB/FB2 parsing + CFI generation |
| `app/services/multi_nlp_manager.py` | 514 | NLP orchestration (4 processors) |
| `app/services/image_generator.py` | 435 | pollinations.ai integration |
| `app/services/parsing_manager.py` | ~300 | Queue + prioritization |
| `app/services/feature_flag_manager.py` | 422 | Feature control |
| `app/services/langextract_processor.py` | 811 | LLM-based extraction (experimental) |
| `app/services/gemini_extractor.py` | 612 | Direct Gemini API (newest) |
| `app/services/nlp/` | ~3000 | Strategy pattern NLP framework |

### Frontend Components
| File | Lines | Purpose |
|------|-------|---------|
| `src/components/Reader/EpubReader.tsx` | 573 | epub.js EPUB reader |
| `src/pages/LibraryPage.tsx` | 739 | Book library + upload |
| `src/services/imageCache.ts` | 482 | IndexedDB offline image cache |
| `src/hooks/epub/useDescriptionHighlighting.ts` | 566 | 9 search strategies for highlighting |

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

## File Structure (Simplified)

```
fancai-vibe-hackathon/
├── frontend/
│   ├── src/components/Reader/    # EPUB reader components
│   ├── src/hooks/epub/           # Reading hooks (CFI, progress)
│   ├── src/services/             # API clients, imageCache
│   └── src/pages/                # Page components
├── backend/
│   ├── app/core/                 # Config, DB, exceptions
│   ├── app/models/               # SQLAlchemy models
│   ├── app/routers/              # API endpoints
│   │   ├── admin/                # Admin endpoints (modular)
│   │   └── books/                # Book endpoints (modular)
│   └── app/services/             # Business logic
│       ├── nlp/                  # NLP strategies + components
│       └── advanced_parser/      # Multi-stage parser
├── docs/                         # Documentation (Diataxis)
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

1. **LLM Migration** - Evaluating Gemini-based parsing vs Multi-NLP
2. **Image Caching** - IndexedDB for offline access
3. **Description Highlighting** - 9-strategy search for accuracy
4. **Reading Progress** - CFI + scroll offset for precise restoration

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
