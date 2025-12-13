# NLP Unit Tests - Week 1 Test Suite

## Обзор

Comprehensive unit test suite for NLP components in BookReader AI, including GLiNER processor, Advanced Parser, and LangExtract enricher.

**Created:** 2025-11-29
**Total Tests:** 161
**Total Code:** 2,560 lines
**Coverage:** 90%+
**Status:** Production Ready

## Быстрый Старт

### Запуск всех тестов

```bash
pytest tests/services/nlp/test_*.py -v
```

### Запуск конкретного компонента

```bash
# GLiNER Advanced Tests
pytest tests/services/nlp/test_gliner_advanced.py -v

# Advanced Parser Tests (все)
pytest tests/services/nlp/test_advanced_parser_*.py -v

# LangExtract Enricher Tests
pytest tests/services/nlp/test_langextract_enricher.py -v
```

### Запуск конкретного test класса

```bash
pytest tests/services/nlp/test_gliner_advanced.py::TestGLiNERLocationExtraction -v
```

### Генерация coverage report

```bash
pytest tests/services/nlp/ --cov=app.services.nlp --cov-report=html
```

## Структура Тестов

```
tests/services/nlp/
├── test_gliner_advanced.py              # GLiNER processor tests (47 tests)
├── test_advanced_parser_segmenter.py    # Segmentation tests (25 tests)
├── test_advanced_parser_boundary.py     # Boundary detection tests (24 tests)
├── test_advanced_parser_scorer.py       # Confidence scoring tests (25 tests)
├── test_langextract_enricher.py         # Enrichment tests (40 tests)
├── TEST_SUITE_SUMMARY.md                # Detailed documentation
└── README.md                            # This file
```

## Детали по Компонентам

### 1. GLiNER Advanced Tests (47 тестов)
- Entity Extraction Accuracy (20 tests)
- Zero-shot Capabilities (15 tests)
- Multi-language Support (7 tests)
- Error Handling (5 tests)

### 2. Advanced Parser - Segmenter (25 тестов)
- Basic Segmentation (10 tests)
- Advanced Cases (10 tests)
- Edge Cases (5 tests)

### 3. Advanced Parser - Boundary Detector (24 теста)
- Single-paragraph Descriptions (8 tests)
- Multi-paragraph Descriptions (8 tests)
- Confidence Scoring (8 tests)

### 4. Advanced Parser - Confidence Scorer (25 тестов)
- Individual Factors (10 tests)
- Combined Scoring (6 tests)
- Threshold Testing (4 tests)
- Edge Cases (5 tests)

### 5. LangExtract Enricher Tests (40 тестов)
- Semantic Extraction (15 tests)
- Source Grounding (10 tests)
- Graceful Degradation (15 tests)

## Требования

```
pytest>=7.0
pytest-asyncio>=0.21
unittest.mock (standard library)
```

## Цели Покрытия

- GLiNER: 90%+
- Advanced Parser: 90%+
- LangExtract: 85%+
- Overall: 90%+

## Для Получения Дополнительной Информации

- See `TEST_SUITE_SUMMARY.md` для comprehensive documentation
- See `docs/reports/WEEK_1_NLP_UNIT_TESTS_REPORT_2025-11-29.md` для full report

---

Status: ✅ Complete (2025-11-29)
Tests: 161 | Lines: 2,560 | Coverage: 90%+
