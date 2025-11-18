# Shared Context Module - BookReader AI

**Version:** 1.0
**Last Updated:** 2025-11-18
**Purpose:** Централизованный контекст проекта для всех агентов (экономия 10-12K tokens)

---

## 📊 Project Overview

**BookReader AI** - веб-приложение для чтения художественной литературы с автоматической генерацией изображений по описаниям из книг.

**Текущий статус:**
- Phase 3: ✅ COMPLETED (October 2025) - Modular refactoring
- Phase 4: 🚨 BLOCKED - 0% test coverage для новой NLP архитектуры
- Production: ✅ LIVE на fancai.ru
- Team: 11 специализированных AI агентов

---

## 🏗️ Current Architecture Status (November 2025)

### Strategy Pattern NLP System

**Location:** `backend/app/services/nlp/`

```
nlp/
├── strategies/ (7 files)
│   ├── single_strategy.py
│   ├── parallel_strategy.py
│   ├── sequential_strategy.py
│   ├── ensemble_strategy.py
│   └── adaptive_strategy.py
├── components/ (3 files)
│   ├── processor_registry.py (196 lines)
│   ├── ensemble_voter.py (192 lines)
│   └── config_loader.py (255 lines)
└── utils/ (5 files)
    ├── text_analysis.py (518 lines)
    ├── quality_scorer.py (395 lines)
    └── ... 3 more
```

**Status:**
- ✅ **Running in production** (2,947 lines total)
- Multi-NLP Manager: 627 → 304 lines (52% reduction)
- ❌ **0% test coverage** (CRITICAL BLOCKER)

---

## 🚨 Phase 4 Critical Blockers

### P0-BLOCKER: Test Coverage

**Problem:** NEW NLP architecture работает в production без тестов

**Requirements:**
- Write 130+ tests (strategies + components + utils)
- Target: 80%+ coverage BEFORE integration
- Timeline: 3-4 weeks

### Unintegrated Components (~4,500 lines)

1. **LangExtract** (464 lines) - 90% ready
   - Needs: Gemini API key
   - Expected: +20-30% semantic accuracy

2. **Advanced Parser** (6 files) - 85% ready
   - Status: NOT in pipeline
   - Expected: +6% F1 score, +10-15% precision

3. **DeepPavlov** (397 lines) - BLOCKED
   - Issue: Dependency conflict (fastapi<=0.89.1, pydantic<2)
   - Solution: Replace with GLiNER

**Priority:** Tests FIRST, then integration

---

## 🌍 Production Environment

**Domain:** fancai.ru

**Stack:**
- **Backend:** FastAPI в Docker
- **Frontend:** Vite build → Nginx
- **Database:** PostgreSQL 15+
- **Cache:** Redis
- **Workers:** Celery + Celery Beat
- **SSL:** Let's Encrypt (auto-renewal)
- **Proxy:** Nginx с HTTPS redirect

**Health Checks:** ✅ Active для всех сервисов

**Recent Fixes (October 2025):**
- Nginx healthcheck fixed
- Celery-beat permissions fixed

---

## 📈 Key Metrics

### Current Performance

| Metric | Value | Status |
|--------|-------|--------|
| Multi-NLP Quality | 3.8/10 | BROKEN |
| F1 Score | 0.82 | Acceptable |
| Test Coverage (NLP) | 0% | CRITICAL |
| Processing Speed | 4s/book (25 chapters) | Good |
| Relevant Descriptions | >70% | Target met |

### Phase 4 Targets

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Multi-NLP Quality | 3.8/10 | 8.5/10 | +124% |
| F1 Score | 0.82 | 0.91+ | +11% |
| Test Coverage | 0% | 80%+ | +∞ |

---

## ⚠️ Critical Warnings

### 1. AdminSettings Model - ORPHANED

**Problem:**
- Model exists in code: `app/models/admin_settings.py`
- Table DELETED from database (October 2025)

**Action:** DO NOT use AdminSettings model

### 2. CFI Reading System (October 2025)

**New fields in ReadingProgress:**
- `reading_location_cfi` (String 500)
- `scroll_offset_percent` (Float 0-100)
- `get_reading_progress_percent()` method

**Purpose:** CFI-based tracking для epub.js

---

## 🔧 Phase 3 Refactoring Results

### Modular Routers

**Admin Router:** 904 lines → 8 modules (46% reduction)
- `admin/stats.py`, `admin/nlp_settings.py`, `admin/parsing.py`
- `admin/images.py`, `admin/system.py`, `admin/users.py`
- `admin/cache.py`, `admin/reading_sessions.py`

**Books Router:** 799 lines → 3 modules
- `books/crud.py` (8 endpoints)
- `books/validation.py`
- `books/processing.py` (5 endpoints)

### DRY Utilities

**Custom Exceptions:** `app/core/exceptions.py` (35+ classes)
**Reusable Dependencies:** `app/core/dependencies.py` (10 functions)

**Impact:** Eliminated ~200-300 lines duplicate error handling

---

## 🧠 Multi-NLP Processors

**Active Processors:**
- **SpaCy** (ru_core_news_lg) - entity recognition, weight 1.0
- **Natasha** - Russian NER, weight 1.2 (специализация)
- **Stanza** (ru) - dependency parsing, weight 0.8
- **DeepPavlov** - NOT integrated (dependency conflicts)

**Processing Modes:**
- SINGLE - один процессор (быстро)
- PARALLEL - параллельная обработка (max coverage)
- SEQUENTIAL - последовательная обработка
- ENSEMBLE - voting с consensus (max quality)
- ADAPTIVE - автоматический выбор режима

**Ensemble Voting:**
- Weighted consensus: SpaCy (1.0), Natasha (1.2), Stanza (0.8)
- Consensus threshold: 0.6 (60%)
- Context enrichment + deduplication

**Benchmark:** 2,171 descriptions in 4 seconds (25 chapters)

---

## 📁 Important File Locations

### Code

**NLP Architecture:**
- Multi-NLP Manager: `backend/app/services/multi_nlp_manager.py` (304 lines)
- NLP Strategies: `backend/app/services/nlp/strategies/` (7 files)
- NLP Components: `backend/app/services/nlp/components/` (3 files)
- NLP Utils: `backend/app/services/nlp/utils/` (5 files)

**Unintegrated:**
- LangExtract: `backend/app/services/llm_description_enricher.py` (464 lines)
- Advanced Parser: `backend/app/services/advanced_parser/` (6 files)
- DeepPavlov: `backend/app/services/deeppavlov_processor.py` (397 lines)

**Legacy Processors:**
- SpaCy: `backend/app/services/enhanced_nlp_system.py`
- Natasha: `backend/app/services/natasha_processor.py`
- Stanza: `backend/app/services/stanza_processor.py`

**Other Core:**
- Book Parser: `backend/app/services/book_parser.py` (796 lines)
- CFI Reading: `backend/app/models/book.py` (ReadingProgress model)
- EPUB Reader: `frontend/src/components/Reader/EpubReader.tsx` (835 lines)

### Documentation

**Planning:**
- Latest Plan: `docs/development/planning/development-plan-2025-11-18.md`
- Calendar: `docs/development/planning/development-calendar.md`
- Gap Analysis: `docs/development/planning/gap-analysis.md`

**Status:**
- Current Status: `docs/development/status/current-status.md`
- Changelog: `docs/development/changelog/2025.md`

**Reports:**
- Executive Summary: `docs/reports/EXECUTIVE_SUMMARY_2025-11-18.md`
- Comprehensive Analysis: `docs/reports/2025-11-18-comprehensive-analysis.md`
- Audit Report: `docs/reports/2025-11-18-comprehensive-audit-report.md`
- Final Work Report: `docs/reports/FINAL_WORK_REPORT_2025-11-18.md`

**Architecture:**
- System Architecture: `docs/explanations/architecture/system-architecture.md`
- Multi-NLP Architecture: `docs/explanations/architecture/nlp/architecture.md`
- Database Schema: `docs/reference/database/schema.md`
- API Documentation: `docs/reference/api/overview.md`

### Agents

**Location:** `.claude/agents/`

**Orchestrator:** `orchestrator.md` (v2.0, model: sonnet)

**Specialists:**
- Multi-NLP Expert: `multi-nlp-expert.md` (v2.0, model: sonnet)
- Backend API Developer: `backend-api-developer.md` (v2.0, model: sonnet)
- Frontend Developer: `frontend-developer.md` (v2.0, model: sonnet)
- Database Architect: `database-architect.md` (v2.0, model: sonnet)
- DevOps Engineer: `devops-engineer.md` (v2.0, model: sonnet)
- Code Quality: `code-quality-refactoring.md` (v2.0, model: sonnet)
- Testing & QA: `testing-qa-specialist.md` (v2.0, model: haiku)
- Documentation Master: `documentation-master.md` (v2.0, model: haiku)
- Analytics: `analytics-specialist.md` (v1.0, model: haiku)

**Shared Context:** `shared_context.md` (этот файл)

---

## 🇷🇺 Critical Language Requirement

**ВСЯ документация и отчеты ДОЛЖНЫ быть написаны ИСКЛЮЧИТЕЛЬНО на русском языке.**

- ✅ Отчеты - на русском
- ✅ Документация - на русском
- ✅ Комментарии в коде - на русском (где применимо)
- ✅ Commit messages - на русском
- ✅ Changelog entries - на русском
- ❌ Английский язык - ЗАПРЕЩЕН для документации

**Исключения:**
- Код (Python, TypeScript) - на английском (имена переменных, функций)
- Технические термины без русского эквивалента
- Цитаты из англоязычных источников

---

## 🎯 Common Development Patterns

### Research-Plan-Implement Workflow

```
1. RESEARCH
   - Think hard о контексте запроса
   - Проанализируй текущее состояние проекта
   - Определи все затронутые компоненты

2. PLAN
   - Декомпозируй на атомарные задачи
   - Определи последовательность выполнения
   - Выбери подходящих агентов

3. IMPLEMENT
   - Делегируй задачи специализированным агентам
   - Координируй параллельное выполнение
   - Валидируй результаты
```

### Extended Thinking Levels

- **"think"** - простые задачи (add endpoint, create component)
- **"think hard"** - средняя сложность (refactoring, optimization)
- **"think harder"** - сложные задачи (architectural changes, new features)
- **"ultrathink"** - критические задачи (Multi-NLP optimization, production deployment)

### Documentation Requirements

**После КАЖДОГО изменения кода:**
1. README.md - если добавлена новая функция
2. development-plan.md - отметить выполненные задачи
3. development-calendar.md - зафиксировать даты
4. changelog.md - детально описать изменения
5. current-status.md - текущее состояние проекта
6. Docstrings в коде

---

## 💡 Quick Reference

### When to Use Which Agent

**Multi-NLP задачи:** Multi-NLP System Expert
- Оптимизация парсинга
- Работа с Strategy Pattern
- Добавление тестов для NLP (BLOCKED до 80% coverage)

**Backend задачи:** Backend API Developer
- Создание endpoints
- FastAPI development
- Pydantic validation

**Database задачи:** Database Architect
- Модели SQLAlchemy
- Миграции Alembic
- Оптимизация запросов
- WARNING: НЕ использовать AdminSettings!

**Frontend задачи:** Frontend Developer
- React компоненты
- TypeScript типы
- EPUB читалка оптимизация

**Testing задачи:** Testing & QA Specialist
- Написание тестов
- Code review
- QA automation
- **URGENT:** Phase 4 NLP testing

**Documentation задачи:** Documentation Master
- Обновление docs
- Генерация docstrings
- API documentation

**Analytics задачи:** Analytics Specialist
- KPI tracking
- User behavior analysis
- Performance metrics

**DevOps задачи:** DevOps Engineer
- Docker setup
- CI/CD pipelines
- Production deployment на fancai.ru

**Code Quality задачи:** Code Quality & Refactoring
- Рефакторинг
- Code smells
- Design patterns
- **Example:** Strategy Pattern refactoring (Nov 2025)

---

## 📊 Success Criteria

**Phase 4 Complete When:**
- ✅ Test coverage >80% для всех новых NLP модулей
- ✅ Multi-NLP Quality score ≥8.5/10
- ✅ F1 Score ≥0.91
- ✅ Все 4 компонента интегрированы и протестированы
- ✅ Documentation accuracy ≥95%
- ✅ Rollback capability verified

---

## 🔄 Version History

- v1.0 (2025-11-18) - Initial shared context module
  - Centralized project information
  - Reduced agent context overhead by 10-12K tokens
  - Standardized common patterns

---

**Usage Note:** Все агенты могут ссылаться на этот документ вместо дублирования контекста.

**Example:**
```markdown
Для детального контекста проекта см. `.claude/agents/shared_context.md`
```
