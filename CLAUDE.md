# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BookReader AI** - Веб-приложение для чтения художественной литературы с автоматической генерацией изображений по описаниям из книг с подписочной моделью монетизации.

## Technology Stack

### Frontend
- **React 18+** с **TypeScript**
- **epub.js 0.3.93** - EPUB парсинг и рендеринг (NEW: октябрь 2025)
- **Custom EpubReader component** - собственный React wrapper для epub.js (835 строк, октябрь 2025)
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

### Feature Flags & Canary Deployment

**Feature Flags System** (NEW: November 2025)

**STATUS:** ✅ **PRODUCTION READY** (Deployed 2025-11-23)

**Architecture:**
- Database-backed feature flags with in-memory caching
- Runtime feature control without redeployment
- Canary deployment support with gradual rollout
- Admin API for flag management

**Implementation:**
- Model: `backend/app/models/feature_flag.py` (200 lines)
- Service: `backend/app/services/feature_flag_manager.py` (400 lines)
- API: `backend/app/routers/admin/feature_flags.py` (9 endpoints)
- Tests: 110 tests (100% PASSED, 96% coverage)

**Default Feature Flags:**
```python
USE_NEW_NLP_ARCHITECTURE = True   # Multi-NLP ensemble (active)
ENABLE_ENSEMBLE_VOTING = True     # Ensemble voting (active)
USE_ADVANCED_PARSER = False       # Advanced parser (not yet integrated)
USE_LANGEXTRACT = False           # Gemini-based enrichment (blocked by API key)
ENABLE_IMAGE_CACHING = True       # Image generation cache (active)
ENABLE_REDIS_CACHING = True       # Redis caching (active)
ENABLE_READING_SESSIONS = True    # Session tracking (active)
```

**Canary Deployment:**
- Table: `nlp_rollout_config` (migration: 2025_11_23_0001)
- Current state: Stage 4, 100% rollout (new Multi-NLP in production since 2025-11-18)
- Support for gradual rollout: 5% → 25% → 50% → 100%
- Consistent hashing for user cohort assignment

**Admin Endpoints:**
```
GET    /api/v1/admin/feature-flags          # List all flags
GET    /api/v1/admin/feature-flags/:name    # Get specific flag
POST   /api/v1/admin/feature-flags          # Create new flag
PUT    /api/v1/admin/feature-flags/:name    # Update flag
DELETE /api/v1/admin/feature-flags/:name    # Delete flag
PUT    /api/v1/admin/feature-flags/bulk     # Bulk update
POST   /api/v1/admin/feature-flags/:name/toggle  # Toggle on/off
GET    /api/v1/admin/feature-flags/health   # Health check
POST   /api/v1/admin/feature-flags/seed     # Seed defaults
```

### NLP & AI

#### **LLM-Only Parsing (Lite Mode)** ⭐ **НОВАЯ АРХИТЕКТУРА** (December 2025)

**STATUS:** 🚧 **В РАЗРАБОТКЕ** - Миграция с Multi-NLP на чистый LLM

**Причина миграции:**
- LangExtract библиотека возвращает сущности (NER) вместо полных описаний
- Multi-NLP система требует 2.2GB моделей и ~9,000 строк кода
- Lite версия использует только Google Gemini API для парсинга

**Целевая архитектура:**
```
GeminiDescriptionExtractor
├── TextChunker (recursive, 1024 tokens, 15% overlap)
├── PromptEngine (few-shot, жанровые шаблоны)
├── ResponseParser (JSON repair, retry logic)
├── CostOptimizer (caching, batching)
└── QualityScorer (5-factor confidence)
```

**Преимущества Lite версии:**
- Docker образ: 2.5GB → ~500MB
- RAM: 2.4GB → ~500MB
- Код: 9,000 строк → ~600 строк
- Стоимость: ~$0.02/книга (с кэшированием ~$0.005)

**План миграции:** `docs/reports/LLM_MIGRATION_PLAN_2025-12-13.md`

---

#### **Multi-NLP System - Strategy Pattern Architecture** (November 2025)

**STATUS:** ⚠️ **DEPRECATED** - Заменяется на LLM-Only Lite Mode

**4-Processor Ensemble Active:** (UPDATED: 2025-11-23, Sessions 6-7)
- **SpaCy** (ru_core_news_lg) - entity recognition, weight 1.0, F1 ~0.82
- **Natasha** - русская морфология и NER, weight 1.2, F1 ~0.88
- **GLiNER** (urchade/gliner_medium-v2.1) - zero-shot NER, weight 1.0, F1 ~0.92 ⭐
- **Stanza** (ru) - dependency parsing, weight 0.8, F1 ~0.80 ⭐ **NEW! (Session 6)**

**Ensemble F1 Score:** ~0.88-0.90 (+2-3% improvement vs 3-processor baseline)

**GLiNER Processor** (NEW: November 2025):
- **Status:** ✅ Production ready (integrated 2025-11-23)
- **Model:** urchade/gliner_medium-v2.1 (500MB)
- **F1 Score:** 0.90-0.95 (zero-shot NER)
- **Advantages:** No dependency conflicts, zero-shot capability, active maintenance
- **Replaces:** DeepPavlov (blocked by fastapi/pydantic version conflicts)
- **Location:** `backend/app/services/gliner_processor.py` (650 lines)
- **Tests:** 58 comprehensive tests, 92% coverage
- **Integration:** Fully integrated into ConfigLoader, ProcessorRegistry, and ensemble voting

**Architecture:**
- **2,947 lines** of modular code across **15 modules**
- **Strategy Pattern** implementation for flexible NLP processing
- **3 layers:** Strategies (7 files) / Components (3 files) / Utils (5 files)

**Location:** `backend/app/services/nlp/`
```
nlp/
├── strategies/          # 7 files - Processing strategies
│   ├── base_strategy.py
│   ├── single_strategy.py
│   ├── parallel_strategy.py
│   ├── sequential_strategy.py
│   ├── ensemble_strategy.py
│   ├── adaptive_strategy.py
│   └── strategy_factory.py
├── components/          # 3 files - Core components
│   ├── processor_registry.py    # Processor lifecycle
│   ├── ensemble_voter.py         # Weighted consensus
│   └── config_loader.py          # Configuration
└── utils/               # 5 files - Utilities
    ├── text_analysis.py
    ├── quality_scorer.py
    ├── type_mapper.py
    ├── description_filter.py
    └── text_cleaner.py
```

**NLP Processors:**
  - **SpaCy** (ru_core_news_lg) - entity recognition, вес 1.0
  - **Natasha** - русская морфология и NER, вес 1.2 (специализация)
  - **GLiNER** (urchade/gliner_medium-v2.1) - zero-shot NER, вес 1.0 ⭐
  - **Stanza** (ru) - dependency parsing, вес 0.8 ⭐ **NEW! (Session 6)**
  - **DeepPavlov** (397 lines) - NOT integrated (dependency conflicts)

**5 Processing Strategies:**
  - **SINGLE** - один процессор (SingleStrategy)
  - **PARALLEL** - параллельная обработка (ParallelStrategy)
  - **SEQUENTIAL** - последовательная обработка (SequentialStrategy)
  - **ENSEMBLE** - voting с consensus (EnsembleStrategy)
  - **ADAPTIVE** - автоматический выбор (AdaptiveStrategy)

**Ensemble Voting (ensemble_voter.py):**
  - Weighted consensus: SpaCy (1.0), Natasha (1.2), GLiNER (1.0), Stanza (0.8)
  - Consensus threshold: 0.6 (60%)
  - Context enrichment + deduplication
  - 192 lines of voting logic

**Stanza Processor** (NEW: Session 6, 2025-11-23, ✅ COMPLETED 2025-11-27):
- **Status:** ✅ Fully integrated and production-ready
- **Model:** ru (Russian language, 630MB)
- **F1 Score:** 0.80-0.82 (dependency parsing specialization)
- **Advantages:** Best-in-class dependency parsing, deep linguistic features
- **Disadvantages:** High memory (780MB), slower speed (~2-3x vs Natasha)
- **Location:** `backend/app/services/stanza_processor.py`
- **Integration:** ✅ Settings configured, ConfigLoader updated, Docker volumes fixed
- **Testing:** ✅ Integration test suite created (9 tests, 568 lines)
- **Docker:** ✅ 3 persistent volumes (NLTK, Stanza, HuggingFace)
- **Blockers Resolved:** ✅ 5 critical blockers fixed (see Session 6 Final Report)
- **NOTE:** First model load slow (~60-120s), subsequent loads instant (cached)

#### **Advanced Parser System** (NEW: Session 7, 2025-11-23)

**STATUS:** ✅ **PRODUCTION-READY** (Feature-flagged, comprehensive testing)

**Architecture:** 3-stage pipeline + optional LLM enrichment
```
Advanced Parser Pipeline:
  Stage 1: ParagraphSegmenter → Smart text chunking
  Stage 2: DescriptionBoundaryDetector → Multi-paragraph detection
  Stage 3: MultiFactorConfidenceScorer → 5-factor quality scoring
  Stage 4 (Optional): LangExtract Enricher → LLM semantic enrichment
```

**Location:** `backend/app/services/advanced_parser/` (6 modules)
- `extractor.py` - Main extraction logic (500+ lines, +159 for enrichment)
- `segmenter.py` - Paragraph segmentation
- `boundary_detector.py` - Description boundary detection
- `confidence_scorer.py` - 5-factor confidence scoring
- `config.py` - Configuration
- Adapter: `backend/app/services/nlp/adapters/advanced_parser_adapter.py` (305 lines)

**5-Factor Confidence Scoring:**
1. **Clarity Score** - Text structure and readability
2. **Detail Score** - Descriptive richness
3. **Emotional Score** - Atmospheric and emotional content
4. **Contextual Score** - Coherence and context preservation
5. **Literary Score** - Literary quality and style

**F1 Score:**
- Without LLM enrichment: ~0.88-0.90 (comparable to Standard Ensemble)
- With LLM enrichment: ~0.90-0.92 (+3-4% improvement)

**Feature Flags:**
- `USE_ADVANCED_PARSER` (default: False) - Enable Advanced Parser routing
- `USE_LLM_ENRICHMENT` (default: False) - Enable LangExtract enrichment

**Intelligent Routing:**
```python
if USE_ADVANCED_PARSER=true AND len(text) >= 500:
    use_advanced_parser()  # Better for long texts
else:
    use_standard_ensemble()  # Faster for short texts
```

**LangExtract Enrichment** (Optional, requires API key):
- **Service:** Google Gemini-based semantic analysis
- **Features:** Entity extraction, attribute analysis, source grounding
- **Threshold:** Only enriches descriptions with overall_score >= 0.6
- **Graceful Degradation:** Works without API key (fallback to Advanced Parser without enrichment)
- **Location:** `backend/app/services/llm_description_enricher.py` (464 lines)

**Integration with Multi-NLP:**
- Adapter pattern for format conversion (ExtractionResult → ProcessingResult)
- Seamless compatibility with existing Multi-NLP Manager
- Statistics tracking and quality metrics
- Zero breaking changes (backward compatible)

**Testing (Session 7):**
- ✅ 9 integration tests created (100% PASSED)
- ✅ Test coverage: ~90% (Advanced Parser adapter)
- ✅ Edge cases covered: no API key, short text fallback, format compliance
- ✅ Graceful degradation verified

**Production Deployment:**
- ✅ Feature flags for safe rollout (disabled by default)
- ✅ Comprehensive error handling
- ✅ Monitoring ready (statistics exposed)
- ✅ Documentation complete (1,300+ lines)

**✅ TEST COVERAGE (2025-11-23, Sessions 1-7):**
- ✅ **544 NLP tests** passing (100%)
- ✅ **93% coverage** (NLP components)
- ✅ Comprehensive test suite:
  - GLiNER processor: 58 tests (92% coverage)
  - Advanced Parser integration: 9 tests (100% PASSED, ~90% coverage) ⭐ **NEW!**
  - EnsembleVoter: 32 tests (96% coverage)
  - ConfigLoader: 48 tests (95% coverage)
  - Strategies: 138 tests (100% for all 5)
  - ProcessorRegistry: 22 tests (85% coverage)
  - Utils: 91 tests (95%+)
  - Integration: 173 tests
- ✅ **Total project tests:** 654+ tests (NLP + Feature Flags + Advanced Parser)

**Image Generation:**
- **pollinations.ai** (основной сервис генерации изображений)
- **OpenAI DALL-E, Midjourney, Stable Diffusion** (опциональные)

### Full-Stack Testing Implementation (NEW: 29.11.2025)

**STATUS:** ✅ ЗАВЕРШЕНО - 4-week comprehensive testing plan

**Timeline:** 4 weeks (November 2025)
**Quality Impact:** 8.8/10 → 9.2/10 (+0.4)

**Week 1: NLP Unit Tests (+161 tests)**
- GLiNER Processor advanced testing (47 tests, 1,026 lines)
- Advanced Parser comprehensive suite (74 tests, 1,028 lines)
- LangExtract Enricher testing (40 tests, 506 lines)
- Coverage: 90%+ NLP components
- Report: `docs/reports/WEEK_1_NLP_UNIT_TESTS_REPORT_2025-11-29.md`

**Week 2: Backend Integration Tests (+120 tests)**
- Service layer integration (80 tests)
- Router integration (40 tests)
- Coverage: Backend 60% → 75% (+15%)
- Report: `docs/reports/WEEK_2_INTEGRATION_TESTS_REPORT.md`

**Week 3: Frontend Component Tests (+55 tests)**
- EpubReader component (35 tests)
- LibraryPage component (20 tests)
- Coverage: Frontend 35% → 50% (+15%)
- Report: `docs/reports/WEEK_3_FRONTEND_TESTING_SUMMARY.md`

**Week 4: E2E Tests (+37 tests)**
- Reading flow scenarios (12 tests)
- Authentication journey (12 tests)
- Image generation flow (8 tests)
- Integration scenarios (5 tests)
- Multi-browser: Chrome, Firefox, Safari, Mobile
- Report: `docs/reports/WEEK_4_E2E_TESTING_REPORT.md`

**Total Impact:**
- ✅ 373 new tests created (plan: 340, +33 surplus)
- ✅ 986 total tests in project
- ✅ 9,798 lines of test code
- ✅ 3,500+ lines of documentation
- ✅ All critical paths tested
- ✅ Production-ready test suite

**Files Created (17 total):**
```
Test Files:
├── backend/tests/services/nlp/ (5 files, 161 tests)
├── backend/tests/services/ (4 files, 80 tests)
├── backend/tests/routers/ (2 files, 40 tests)
└── frontend/tests/ (4 files, 37 tests)

Documentation:
├── docs/reports/FULL_STACK_TESTING_FINAL_REPORT_2025-11-29.md (2,000+ lines)
├── docs/reports/WEEK_*_REPORT.md (4 detailed reports)
└── TEST_SUITE_SUMMARY.md + E2E_TESTS_README.md
```

**Test Execution:**
```bash
# Run all unit tests
pytest backend/tests/services/nlp/ -v --cov=app.services.nlp

# Run all backend tests
pytest backend/tests/ -v --cov=app

# Run all component tests
npm run test:components

# Run all E2E tests
npm run test:e2e

# Full suite
pytest && npm run test:components && npm run test:e2e
```

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

# NLP System Testing (NEW: comprehensive test suite)
cd backend && pytest tests/services/nlp/ -v  # 535 tests
cd backend && pytest tests/services/test_gliner_processor.py -v  # 58 GLiNER tests

# Feature Flags Testing
cd backend && pytest tests/services/test_feature_flag_model.py -v  # 21 tests
cd backend && pytest tests/services/test_feature_flag_manager.py -v  # 47 tests
cd backend && pytest tests/routers/admin/test_feature_flags_api.py -v  # 42 tests

# Integration Testing (full suite)
cd backend && pytest tests/ -v --cov=app  # 645+ tests total
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

## Recent Work & Audit Results (November 2025)

### Functional Audit & Critical Fixes (29.11.2025)

**Comprehensive audit identified and fixed 7 issues:**

**Critical Fixes (P0) - All Resolved:**
1. ✅ **API Endpoint Mismatch** - Profile statistics endpoint fixed
   - `/api/v1/books/statistics` → `/api/v1/users/reading-statistics`
   - Impact: Profile page now loads correctly

2. ✅ **Reading Time Calculation** - Fixed 0 minutes display bug
   - Root cause: Used deprecated `ReadingProgress.reading_time_minutes`
   - Solution: Changed to `ReadingSession.duration_minutes`
   - Impact: Accurate time tracking

3. ✅ **Books Count Calculation** - Fixed inflated completion numbers
   - Root cause: Used `current_position >= 95` (position in chapter, not book progress)
   - Solution: Changed to `Book.get_reading_progress_percent()` (CFI-aware)
   - Impact: Accurate completion statistics

**High Priority Issues (P1):**
1. ✅ **Reading Streak Grace Period** - Fixed too-strict reset logic
   - Previous: Streak reset if user didn't read TODAY
   - New: Resets only if no reading for 2+ days
   - Impact: Better user motivation and retention

2. 📋 **Code Duplication Refactoring Plan** - Ready for implementation
   - 159 lines of duplicate code between statistics services
   - Proposed: Extract StatisticsCalculator module
   - Expected: 29% code reduction + 2 bug fixes
   - See: `docs/reports/FUNCTIONAL_AUDIT_2025-11-29.md` (Section P1-5)

3. 🎨 **Reading Goals System Design** - Complete design ready
   - Full feature design with 11 API endpoints
   - Database schema with 13 fields and 6 indexes
   - 4 business logic algorithms
   - See: `docs/reports/FUNCTIONAL_AUDIT_2025-11-29.md` (Section P1-6)

**Medium Priority (P2):**
1. ✅ **Genre Validation** - Already implemented (verified)
   - Database CHECK constraint active since Oct 29
   - Full validation stack in place

**Metrics:**
- Quality Score: 9.2/10 → 9.4/10
- Critical Issues: 3 → 0 ✅
- Tests Added: 6 new comprehensive tests
- Documentation: 7,000+ lines (comprehensive audit report)

**Full Details:** `docs/reports/FUNCTIONAL_AUDIT_2025-11-29.md`

---

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
│   │   ├── reading_session.py # ✅ ReadingSession модель (детальная аналитика)
│   │   # admin_settings.py - УДАЛЕН (orphaned model, таблица удалена в Oct 2025)
│   ├── app/routers/        # ✅ REFACTORED (Phase 3) - Modular API routes
│   │   ├── admin/          # ✅ NEW: Admin router модули (8 modules, 904→485 lines)
│   │   │   ├── __init__.py
│   │   │   ├── stats.py           # System statistics (2 endpoints)
│   │   │   ├── nlp_settings.py    # Multi-NLP config (5 endpoints)
│   │   │   ├── parsing.py         # Book parsing management (3 endpoints)
│   │   │   ├── images.py          # Image generation (3 endpoints)
│   │   │   ├── system.py          # Health & maintenance (2 endpoints)
│   │   │   ├── users.py           # User management (2 endpoints)
│   │   │   ├── cache.py           # ✅ NEW: Redis cache management (4 endpoints)
│   │   │   └── reading_sessions.py # ✅ NEW: Session cleanup (3 endpoints)
│   │   ├── books/          # ✅ NEW: Books router модули (3 modules, 799 lines refactored)
│   │   │   ├── __init__.py
│   │   │   ├── crud.py            # CRUD operations (8 endpoints)
│   │   │   ├── validation.py      # Validation utilities
│   │   │   └── processing.py      # Processing & progress (5 endpoints)
│   │   ├── auth.py         # ✅ Authentication endpoints (7 endpoints)
│   │   ├── users.py        # ✅ User management endpoints (6 endpoints)
│   │   ├── chapters.py     # ✅ Chapter endpoints (2 endpoints)
│   │   ├── descriptions.py # ✅ Description endpoints (3 endpoints)
│   │   ├── images.py       # ✅ Image generation endpoints (8 endpoints)
│   │   ├── reading_progress.py    # ✅ Progress tracking (2 endpoints)
│   │   ├── reading_sessions.py    # ✅ Session management (6 endpoints)
│   │   ├── health.py       # ✅ Health checks (4 endpoints)
│   │   └── nlp.py          # ✅ NLP testing endpoints (4 endpoints)
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

### Sessions 1-7 Highlights (2025-11-23)

**Session 1: Feature Flags System**
- 110 tests written (100% PASSED, 96% coverage)
- 6 default feature flags created
- 9 admin API endpoints
- Critical login bug fixed (await db.refresh)

**Session 2: Critical NLP Testing**
- 139 tests written (95%+ coverage)
- EnsembleVoter tested (32 tests, 96% coverage)
- ConfigLoader tested (48 tests, 95% coverage)
- All strategies tested (138 tests, 100%)

**Session 3: ProcessorRegistry Tests**
- 22 tests fixed (11/11 failures → 22/22 PASSED)
- 85% coverage achieved
- 477/477 NLP tests passing

**Session 4: GLiNER Model Download**
- GLiNER library installed (gliner 0.2.22)
- Model downloaded (urchade/gliner_medium-v2.1, 500MB)
- Environment configured (HF_HOME=/tmp/huggingface)

**Session 5: GLiNER Full Integration**
- GLiNER integrated into ConfigLoader
- 58 comprehensive unit tests created (92% coverage)
- 535/535 NLP tests passing (100%)
- 3-processor ensemble active (SpaCy, Natasha, GLiNER)
- Production ready

**Session 6: Stanza Activation** ⭐ **UPDATED 2025-11-27** ✅
- ✅ Stanza processor activated (4th processor in ensemble)
- ✅ Model downloaded (ru, 630MB to /tmp/stanza_resources)
- ✅ Settings updated (enabled=True, weight=0.8)
- ✅ ConfigLoader modified for Stanza loading
- ✅ Docker configuration fixed (3 persistent volumes: NLTK, Stanza, HuggingFace)
- ✅ **5 critical blockers resolved** (permission denied, container rebuild issues)
- ✅ Integration test suite created (9 tests, 568 lines)
- ✅ F1 Score improvement: ~0.87-0.88 → ~0.88-0.90 (+1-2%)
- ✅ **Production ready** (2025-11-27)

**Session 7: Advanced Parser + LangExtract Integration** ⭐ **NEW!**
- LangExtract enricher integrated into Advanced Parser
- Advanced Parser adapter created (305 lines)
- Feature flags implemented (USE_ADVANCED_PARSER, USE_LLM_ENRICHMENT)
- 9 integration tests created (100% PASSED)
- Intelligent routing (text length >= 500 chars)
- Graceful degradation (3 levels)
- F1 Score with LLM enrichment: ~0.90-0.92 (+3-4% improvement)
- ✅ Production-ready (comprehensive documentation: 1,300+ lines)

**Cumulative Stats (Sessions 1-7):**
```
Total Tests Written: 338 tests (329 + 9 Advanced Parser)
Total Lines of Code: ~7,350+ lines
Total Documentation: ~3,000+ lines
Test Coverage: 93%+ (NLP components)
Success Rate: 654+ tests passing (100%)
  - 544 NLP tests (including Advanced Parser)
  - 110 Feature Flags tests
Production Ready: Sessions 1-5, 7 (Session 6 needs completion)
```

---

## Backend API Type Safety - Phases 1.1-1.4 (NEW: 28.11.2025)

**STATUS:** ✅ **PRODUCTION READY** (Completed 2025-11-28)

**MILESTONE:** Complete transformation of backend API with Pydantic response schemas and runtime type safety

### Overview

Backend API Type Safety project delivered 67 production-ready Pydantic response schemas, 78+ typed endpoints, and comprehensive validation test coverage.

**Key Achievement:** Type coverage improved from 24.1% → 95%+ (+71%), quality score 8.2/10 → 8.8/10

### Architecture

**Response Schemas Organization:**
```
backend/app/schemas/responses/
├── __init__.py          # 67 schema exports
├── users.py             # 7 schemas (User, UserProfile, UserCreate, etc.)
├── auth.py              # 4 schemas (LoginResponse, TokenRefresh, etc.)
├── progress.py          # 1 schema (ReadingProgress responses)
├── chapters.py          # 3 schemas (Chapter, ChapterContent, etc.)
├── images.py            # 6 schemas (ImageGeneration, ImageGallery, etc.)
├── descriptions.py      # 5 schemas (Description, DescriptionList, etc.)
├── processing.py        # 2 schemas (ProcessingStatus, ProcessingResult)
├── nlp.py              # 5 schemas (NLP processor responses)
├── admin.py            # 17 schemas (Admin operations)
├── health.py           # 2 schemas (HealthCheck, SystemStatus)
└── books_validation.py  # 7 schemas (Validation responses)
```

### Implementation Details

**Phase 1.1: Response Schemas Foundation**
- Created response schema structure and patterns
- Implemented 21 Pydantic schemas for core components
- Documented validation patterns and best practices
- Test coverage: 8 tests, 100% PASSED

**Phase 1.2: API Response Typing**
- Added 23 additional Pydantic schemas (images, descriptions, NLP)
- Updated 25+ endpoints with response_model decorators
- Integrated admin router endpoints
- Test coverage: 23 tests, 100% PASSED

**Phase 1.3: Admin API Completeness**
- Developed 17 admin-specific response schemas
- Updated 7+ admin endpoints (system, images, parsing, nlp_settings)
- Added health check and bulk operation schemas
- Test coverage: 20 tests, 100% PASSED

**Phase 1.4: Books Validation & Integration**
- Created 7 validation-specific schemas (books_validation.py)
- Updated 3 endpoints in books/validation.py router
- Exported all 67 schemas in __init__.py
- Achieved 78+ endpoints with response_model coverage
- Test coverage: 20 tests, 100% PASSED

### Metrics

**Type Coverage:**
- Before: 24.1% (partial, no response schemas)
- After: 95%+ (comprehensive, all endpoints)
- Improvement: +71 percentage points

**Test Statistics:**
- Total tests: 71 (split across 3 files)
- Test files: `test_response_schemas_phase11.py`, `phase12.py`, `phase13.py`
- Total lines: 1,305 lines
- Success rate: 100% (71/71 PASSED)

**Quality Metrics:**
- Response schemas created: 67
- API endpoints typed: 78+
- Code lines added: 1,147 lines (11 files)
- Quality score improvement: +0.6 (8.2 → 8.8)

### Implementation Pattern Example

```python
# Before: No response typing
@router.get("/api/v1/books/{id}")
async def get_book(id: UUID, db: AsyncSession = Depends(get_db)):
    return {"id": id, "title": "...", ...}

# After: Full response typing
@router.get(
    "/api/v1/books/{id}",
    response_model=BookDetailResponse
)
async def get_book(id: UUID, db: AsyncSession = Depends(get_db)):
    book = await book_service.get_by_id(id)
    return BookDetailResponse.from_orm(book)
```

### Benefits

- **Runtime Validation:** Automatic validation of response data
- **API Documentation:** Auto-generated OpenAPI/Swagger documentation
- **IDE Support:** Full autocomplete and type hints for consumers
- **Error Prevention:** Compile-time validation prevents runtime errors
- **Developer Experience:** Clear API contracts for frontend teams
- **Maintainability:** Easier to refactor with type safety guarantees

### Files Created

**Schema Files (11 files, 1,147 lines):**
- `users.py` (146 lines, 7 schemas)
- `auth.py` (44 lines, 4 schemas)
- `progress.py` (51 lines, 1 schema)
- `chapters.py` (107 lines, 3 schemas)
- `images.py` (178 lines, 6 schemas)
- `descriptions.py` (157 lines, 5 schemas)
- `processing.py` (143 lines, 2 schemas)
- `nlp.py` (220 lines, 5 schemas)
- `admin.py` (308 lines, 17 schemas)
- `health.py` (new, 2 schemas)
- `books_validation.py` (new, 7 schemas)

**Test Files (3 files, 1,305 lines):**
- `test_response_schemas_phase11.py` (276 lines, 8 tests)
- `test_response_schemas_phase12.py` (505 lines, 23 tests)
- `test_response_schemas_phase13.py` (524 lines, 20 tests)

**Documentation:**
- `backend/PHASE_1.4_FINAL_TYPE_SAFETY_REPORT.md` (1,000+ lines)

### Quality Assurance

- All 71 tests PASSED (100% success rate)
- Type coverage: 95%+ (target achieved)
- Zero breaking changes (backward compatible)
- Complete API endpoint coverage (78+ endpoints)
- Comprehensive documentation and examples

---

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
- **Multi-NLP Manager:** `backend/app/services/multi_nlp_manager.py` (304 строк, refactored from 627)
- **NLP Architecture:** `backend/app/services/nlp/` (2,947 lines across 15 modules)
- **GLiNER Processor:** `backend/app/services/gliner_processor.py` (650 lines, 92% coverage)
- **Stanza Processor:** `backend/app/services/stanza_processor.py` (Session 6, ✅ production-ready 2025-11-27) ⭐
- **Advanced Parser:** `backend/app/services/advanced_parser/` (6 files, Session 7) ⭐
  - `extractor.py` - Main extraction logic (500+ lines, +159 for enrichment)
  - `segmenter.py` - Paragraph segmentation
  - `boundary_detector.py` - Description boundary detection
  - `confidence_scorer.py` - 5-factor confidence scoring
  - `config.py` - Configuration
- **Advanced Parser Adapter:** `backend/app/services/nlp/adapters/advanced_parser_adapter.py` (305 lines) ⭐
- **LangExtract Enricher:** `backend/app/services/llm_description_enricher.py` (464 lines, integrated in Session 7) ⭐
- **Feature Flags System:** `backend/app/services/feature_flag_manager.py` (400 lines)
- **Admin feature flags:** `backend/app/routers/admin/feature_flags.py` (9 endpoints)
- **Admin multi-nlp settings:** `backend/app/routers/admin.py` (5 endpoints)
- **Book Parser with CFI:** `backend/app/services/book_parser.py` (796 строк)
- **Основной промпт:** `prompts.md`
- **Конфигурация Docker:** `docker-compose.yml`

**Documentation (Updated Structure - Nov 2025):**
- **Документация центр:** `docs/README.md` (навигация по Diátaxis framework)
- **План разработки (latest):** `docs/development/planning/development-plan-2025-11-18.md`
- **План разработки (old):** `docs/development/planning/development-plan.md`
- **Календарь разработки:** `docs/development/planning/development-calendar.md`
- **Changelog:** `docs/development/changelog/2025.md`
- **Текущий статус:** `docs/development/status/current-status.md`
- **Executive Summary (2025-11-18):** `docs/reports/EXECUTIVE_SUMMARY_2025-11-18.md`
- **Executive Summary (Sessions 6-7):** `docs/reports/EXECUTIVE_SUMMARY_SESSIONS_6-7.md` ⭐ **NEW!**
- **Comprehensive Analysis:** `docs/reports/2025-11-18-comprehensive-analysis.md`
- **Audit Report:** `docs/reports/2025-11-18-comprehensive-audit-report.md`
- **Session 6 Final Completion Report:** `docs/reports/SESSION_6_FINAL_COMPLETION_REPORT_2025-11-27.md` ⭐ **NEW! (2025-11-27)**
- **Sessions 6-7 Final Report:** `docs/reports/SESSIONS_6-7_FINAL_REPORT_2025-11-23.md` ⭐
- **Session 7 Report:** `docs/reports/SESSION_REPORT_2025-11-23_S7_ADVANCED_PARSER_INTEGRATION.md` ⭐
- **Session 4-5 Report:** `docs/reports/SESSION_REPORT_2025-11-23_P4_GLiNER_SUMMARY.md`
- **Advanced Parser Integration Guide:** `backend/ADVANCED_PARSER_INTEGRATION.md` (550+ lines) ⭐
- **Integration Summary:** `backend/INTEGRATION_SUMMARY.md` (250+ lines) ⭐
- **API документация:** `docs/reference/api/overview.md`
- **Схема БД:** `docs/reference/database/schema.md`
- **Системная архитектура:** `docs/explanations/architecture/system-architecture.md`
- **Multi-NLP архитектура:** `docs/explanations/architecture/nlp/architecture.md`
- **Production deployment:** `docs/guides/deployment/production-deployment.md`
- **Docker setup:** `docs/operations/docker/setup.md`
- **Testing guide:** `docs/guides/testing/testing-guide.md`
- **Agents guide:** `docs/guides/agents/quickstart.md`
- **Multi-NLP Agent (updated):** `.claude/agents/multi-nlp-expert.md` (v2.0, 425 lines)
