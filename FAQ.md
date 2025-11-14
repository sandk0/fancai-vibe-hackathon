# Frequently Asked Questions (FAQ)

Common questions and answers about BookReader AI.

## Table of Contents

- [General Questions](#general-questions)
- [Getting Started](#getting-started)
- [Development](#development)
- [Features](#features)
- [Multi-NLP System](#multi-nlp-system)
- [Performance](#performance)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## General Questions

### What is BookReader AI?

BookReader AI is a web application for reading fiction with automatic AI-generated illustrations based on descriptions extracted from books. It uses advanced NLP technologies to extract descriptions and AI services to create visualizations.

### What book formats are supported?

Currently supported formats:
- **EPUB** (recommended) - Full support with CFI positioning
- **FB2** - Full support
- **PDF** - Planned for Phase 2
- **MOBI** - Planned for Phase 2

### What languages are supported?

The NLP system is optimized for **Russian language** using:
- SpaCy (ru_core_news_lg)
- Natasha (Russian morphology specialist)
- Stanza (Russian dependency parsing)

English support is planned for Phase 2.

### Is this project open source?

This is currently a private project. Licensing details will be announced later.

### What is the current project status?

**Phase 1 (MVP)** is 100% complete (as of October 2025):
- Full book management system
- Advanced Multi-NLP parser
- AI image generation
- CFI reading system with epub.js
- Production-ready deployment
- Comprehensive testing suite

For detailed status, see [Current Status](docs/development/status/current-status.md).

---

## Getting Started

### How do I install BookReader AI?

**Quick start:**
```bash
git clone <repository-url>
cd fancai-vibe-hackathon
cp .env.example .env
docker-compose up -d
```

For detailed instructions, see [Installation Guide](docs/guides/getting-started/installation.md).

### What are the system requirements?

**Development:**
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 6+
- Docker & Docker Compose
- 4GB+ RAM recommended

**Production:**
- 8GB+ RAM
- 4+ CPU cores
- 50GB+ SSD storage
- Ubuntu 20.04+ or similar

### How long does setup take?

- **With Docker:** 5-10 minutes (automated)
- **Manual setup:** 30-60 minutes (backend + frontend + database)

### Do I need API keys for AI services?

**For development:**
- pollinations.ai - No API key needed (free, default service)
- OpenAI DALL-E - Optional (requires API key)
- Midjourney - Optional (requires subscription)

**For production:**
- Recommended to set up at least one paid service for reliability

---

## Development

### How do I run tests?

```bash
# Backend tests
cd backend && pytest -v --cov=app

# Frontend tests
cd frontend && npm test

# E2E tests
cd frontend && npm run test:e2e

# All tests
npm run test:all
```

See [Testing Guide](docs/guides/testing/testing-guide.md) for details.

### How do I run the development server?

```bash
# With Docker (recommended)
docker-compose -f docker-compose.dev.yml up

# Without Docker
# Terminal 1: Backend
cd backend && uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Celery worker
cd backend && celery -A app.core.celery worker --loglevel=info
```

### What IDE is recommended?

**Backend (Python):**
- PyCharm Professional (recommended)
- VS Code with Python extension
- Vim/Neovim with LSP

**Frontend (TypeScript):**
- VS Code (recommended)
- WebStorm
- Vim/Neovim with LSP

### How do I debug the application?

See [Troubleshooting Guide](TROUBLESHOOTING.md) for common issues.

**Backend debugging:**
```python
# Add breakpoint
import pdb; pdb.set_trace()

# Or use your IDE's debugger
```

**Frontend debugging:**
- Use browser DevTools (Chrome/Firefox)
- React DevTools extension
- Redux DevTools for state inspection

---

## Features

### How does the Multi-NLP system work?

The Multi-NLP system uses **3 specialized processors**:
- **SpaCy** (ru_core_news_lg) - Entity recognition, weight 1.0
- **Natasha** - Russian morphology specialist, weight 1.2
- **Stanza** (ru) - Dependency parsing, weight 0.8

It operates in **5 modes**:
1. **SINGLE** - One processor (fast)
2. **PARALLEL** - All processors in parallel (max coverage)
3. **SEQUENTIAL** - Sequential processing (controlled)
4. **ENSEMBLE** - Voting with weighted consensus (max quality) ⭐ Recommended
5. **ADAPTIVE** - Automatic mode selection (intelligent)

For details, see [Multi-NLP System](docs/reference/nlp/multi-nlp-system.md).

### What is CFI and why do we use it?

**CFI (Canonical Fragment Identifier)** is a standard for precise positioning in EPUB books.

Benefits:
- Pixel-perfect reading position restoration
- Works across different screen sizes
- Standard-compliant (EPUB 3)
- Supported by epub.js out of the box

See [CFI System Explanation](docs/explanations/concepts/cfi-system.md).

### How does image generation work?

1. **Book Upload** → Parser extracts chapters
2. **NLP Processing** → Multi-NLP extracts descriptions
3. **Prompt Engineering** → Generates prompts based on genre/type
4. **AI Generation** → pollinations.ai creates images
5. **Caching** → Deduplication and storage
6. **Display** → Smart highlighting in reader

Average generation time: <30 seconds per image.

### Can I use custom AI services?

Yes! The system supports:
- pollinations.ai (default, free)
- OpenAI DALL-E (requires API key)
- Midjourney (requires subscription)
- Custom services (implement interface)

Configure in `backend/app/core/config.py`.

---

## Multi-NLP System

### Which NLP mode should I use?

**Recommendations:**
- **ENSEMBLE** - Best quality, recommended for production (60% consensus)
- **ADAPTIVE** - Intelligent automatic selection
- **PARALLEL** - Maximum coverage but slower
- **SINGLE** - Fast testing/development

### How accurate is the description extraction?

**Current metrics:**
- Relevance: >70% (KPI achieved ✅)
- SpaCy quality: 0.78
- Natasha quality: 0.82 (best)
- Stanza quality: 0.75

Test case: 2,171 descriptions extracted in 4 seconds from a 25-chapter book.

### Can I adjust NLP processor weights?

Yes! Use the Admin API:

```bash
# Update SpaCy weight
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/spacy \
  -H "Content-Type: application/json" \
  -d '{"weight": 1.2, "threshold": 0.3}'

# Update Natasha weight
curl -X PUT http://localhost:8000/api/v1/admin/multi-nlp-settings/natasha \
  -H "Content-Type: application/json" \
  -d '{"weight": 1.0, "threshold": 0.25}'
```

See [Multi-NLP Admin API](docs/reference/api/admin-nlp.md).

### What types of descriptions are extracted?

Three main types:
1. **Location** - Places, settings, environments
2. **Character** - Character appearances, clothing
3. **Atmosphere** - Mood, ambiance, weather

Each type has specific patterns optimized for Russian literature.

---

## Performance

### How fast is the book parsing?

**Benchmark (25-chapter book):**
- Book upload: <2 seconds
- EPUB parsing: ~1 second
- NLP processing: ~4 seconds (2,171 descriptions)
- Total: ~7 seconds

With ENSEMBLE mode on 3 processors.

### What about reader performance?

**Metrics:**
- Page load time: <2 seconds
- Time to Interactive: 1.2s (66% faster with optimizations)
- Bundle size: 386KB gzipped (29% smaller)

### How does caching work?

**Redis caching:**
- Cache hit rate: 85%
- API response time: 200-500ms → <50ms (cached)
- TTL: 1 hour for book metadata, user sessions

**Database:**
- JSONB + GIN indexes: 100x faster queries (<5ms)
- Concurrent users: 500+ (10x increase)

See [Performance Report](docs/reports/performance/week17-database-performance.md).

### Can the system handle many concurrent users?

Yes! After Week 17 optimizations:
- **50 → 500+ concurrent users** (10x increase)
- Rate limiting protects against abuse
- Redis caching reduces database load by 70%

---

## Deployment

### How do I deploy to production?

```bash
# Initialize environment
./scripts/deploy.sh init

# Set up SSL
./scripts/deploy.sh ssl

# Deploy application
./scripts/deploy.sh deploy

# Check status
./scripts/deploy.sh status
```

See [Production Deployment Guide](docs/guides/deployment/production-deployment.md).

### What about SSL certificates?

Automatic SSL setup with Let's Encrypt:
```bash
./scripts/deploy.sh ssl
```

Certificates auto-renew via cron job.

### How do I monitor the application?

**Monitoring stack (optional):**
```bash
./scripts/setup-monitoring.sh start
```

Includes:
- **Prometheus** - Metrics collection
- **Grafana** - Visualization dashboards
- **Loki** - Log aggregation

Access Grafana at `http://your-domain:3000`.

### What about backups?

**Automated backups:**
```bash
# Daily backups (cron)
./scripts/backup.sh full

# Restore from backup
./scripts/backup.sh restore backup_name.tar.gz
```

See [Backup Procedures](docs/operations/backup/procedures.md).

---

## Troubleshooting

### Docker containers won't start

**Check logs:**
```bash
docker-compose logs backend
docker-compose logs frontend
```

**Common issues:**
- Port conflicts (8000, 5173, 5432, 6379)
- Missing .env file
- Incorrect environment variables

See [Troubleshooting Guide](TROUBLESHOOTING.md) for solutions.

### NLP models not found

**Install required models:**
```bash
# SpaCy
python -m spacy download ru_core_news_lg

# Stanza
python -c "import stanza; stanza.download('ru')"

# Natasha (installed via pip)
pip install natasha
```

### Database migrations fail

**Reset and retry:**
```bash
# Check current version
cd backend && alembic current

# Downgrade if needed
alembic downgrade -1

# Upgrade
alembic upgrade head

# Force clean (development only!)
docker-compose down -v
docker-compose up -d
```

### Frontend build errors

**Clean and reinstall:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Images not generating

**Check:**
1. pollinations.ai service status
2. Celery worker running: `docker-compose logs celery-worker`
3. Redis connection: `docker-compose logs redis`

**Restart Celery:**
```bash
docker-compose restart celery-worker
```

### Tests failing

**Common causes:**
1. Missing test fixtures
2. Database not in test mode
3. Async tests not properly awaited
4. Environment variables not set

**Debug:**
```bash
# Run specific test with verbose output
pytest tests/test_file.py::test_function -v -s

# Check test coverage
pytest --cov=app --cov-report=html
```

---

## Contributing

### How can I contribute?

1. Read [CONTRIBUTING.md](CONTRIBUTING.md)
2. Check [open issues](https://github.com/your-org/fancai-vibe-hackathon/issues)
3. Fork the repository
4. Create a feature branch
5. Make changes with tests
6. Submit a pull request

### What are the coding standards?

**Backend (Python):**
- PEP 8 with Black formatting
- Type hints required (MyPy strict mode)
- Docstrings (Google style)
- Test coverage >70%

**Frontend (TypeScript):**
- ESLint + Prettier
- Strict type checking
- JSDoc comments
- React best practices

See [Coding Standards](CONTRIBUTING.md#coding-standards).

### How do I write documentation?

**Required for every change:**
1. Update README.md (if new feature)
2. Update development-plan.md (mark tasks)
3. Update development-calendar.md (dates)
4. Update changelog.md (detailed description)
5. Update current-status.md (project state)
6. Add docstrings/comments in code

See [Documentation Requirements](CONTRIBUTING.md#documentation-requirements).

### How long does PR review take?

- Simple fixes: 1-2 days
- New features: 3-7 days
- Breaking changes: 1-2 weeks

Automated CI/CD checks run immediately.

---

## Still Have Questions?

- **Documentation:** Check [docs/](docs/) directory
- **Issues:** Search [GitHub Issues](https://github.com/your-org/fancai-vibe-hackathon/issues)
- **Troubleshooting:** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Contributing:** See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Contact:** Open a new issue with your question

---

**Last Updated:** November 14, 2025
