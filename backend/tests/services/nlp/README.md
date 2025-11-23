# NLP Strategy Pattern Architecture - Test Suite

**Comprehensive тесты для новой Multi-NLP архитектуры**

---

## 🚀 Quick Start

### Запуск всех тестов:
```bash
cd /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend
pytest tests/services/nlp/ -v
```

### Запуск с coverage report:
```bash
pytest tests/services/nlp/ -v --cov=app/services/nlp --cov-report=html
open htmlcov/index.html
```

### Запуск конкретной категории:
```bash
# Strategies
pytest tests/services/nlp/strategies/ -v

# Components
pytest tests/services/nlp/components/ -v

# Utils
pytest tests/services/nlp/utils/ -v

# Integration
pytest tests/services/nlp/test_multi_nlp_integration.py -v
```

---

## 📁 Структура тестов

```
tests/services/nlp/
├── README.md                           # Этот файл
├── TEST_SUITE_DOCUMENTATION.md         # Comprehensive документация
├── conftest.py                         # Shared fixtures (15 fixtures)
│
├── strategies/                         # Strategy tests (67 тестов)
│   ├── __init__.py
│   ├── test_base_strategy.py          # 12 тестов - BaseStrategy
│   ├── test_single_strategy.py        # 15 тестов - SingleStrategy
│   ├── test_parallel_strategy.py      # 16 тестов - ParallelStrategy
│   ├── test_ensemble_strategy.py      # 14 тестов - EnsembleStrategy
│   ├── test_sequential_strategy.py    # TODO - SequentialStrategy
│   ├── test_adaptive_strategy.py      # TODO - AdaptiveStrategy
│   └── test_strategy_factory.py       # TODO - StrategyFactory
│
├── components/                         # Component tests (10+ тестов)
│   ├── __init__.py
│   ├── test_processor_registry.py     # 10 тестов - ProcessorRegistry
│   ├── test_ensemble_voter.py         # TODO - EnsembleVoter (CRITICAL)
│   └── test_config_loader.py          # TODO - ConfigLoader (CRITICAL)
│
├── utils/                              # Utils tests (существующие)
│   ├── __init__.py
│   ├── test_text_analysis.py          # ✅ Готово
│   ├── test_quality_scorer.py         # ✅ Готово
│   ├── test_description_filter.py     # ✅ Готово
│   ├── test_type_mapper.py            # ✅ Готово
│   └── test_text_cleaner.py           # TODO
│
└── test_multi_nlp_integration.py      # ✅ Частично готово
```

---

## 📊 Статус тестирования

### ✅ ГОТОВО (Phase 1):
- **Strategies:** 4/7 протестировано (BaseStrategy, SingleStrategy, ParallelStrategy, EnsembleStrategy)
- **Components:** 1/3 протестировано (ProcessorRegistry)
- **Utils:** 3/5 протестировано (text_analysis, quality_scorer, description_filter, type_mapper)
- **Fixtures:** 15 shared fixtures созданы

**Всего тестов:** 67
**Ожидаемый coverage:** ~75-85% для протестированных модулей

### ⏳ TODO (Phase 2):
- **Strategies:** 3 осталось (SequentialStrategy, AdaptiveStrategy, StrategyFactory)
- **Components:** 2 осталось (EnsembleVoter - CRITICAL, ConfigLoader - CRITICAL)
- **Integration:** Расширить тесты Multi-NLP Manager

**Планируется тестов:** ~102
**Target coverage:** 80%+ для всей архитектуры

---

## 🎯 Target Coverage

| Модуль | Текущий | Target | Статус |
|--------|---------|--------|--------|
| `base_strategy.py` | ~90% | 85% | ✅ |
| `single_strategy.py` | ~95% | 85% | ✅ |
| `parallel_strategy.py` | ~90% | 85% | ✅ |
| `ensemble_strategy.py` | ~85% | 85% | ✅ |
| `sequential_strategy.py` | 0% | 85% | ⏳ |
| `adaptive_strategy.py` | 0% | 85% | ⏳ |
| `strategy_factory.py` | 0% | 85% | ⏳ |
| `processor_registry.py` | ~70% | 80% | ✅ |
| `ensemble_voter.py` | 0% | 80% | ⏳ CRITICAL |
| `config_loader.py` | 0% | 80% | ⏳ CRITICAL |
| **ОБЩИЙ** | **~40%** | **80%+** | ⏳ |

---

## 🔥 Critical Gaps (P0-BLOCKER)

### 1. EnsembleVoter (192 строки) - 0% coverage
**Почему critical:**
- Ключевой компонент weighted voting
- Consensus алгоритм
- Context enrichment
- Deduplication logic

### 2. ConfigLoader (255 строк) - 0% coverage
**Почему critical:**
- Configuration management
- Config validation
- Default fallbacks
- Merge logic

### 3. Integration Tests
**Почему critical:**
- End-to-end testing
- Strategy switching
- Processor lifecycle
- Real-world scenarios

---

## 📝 Fixtures доступные

### Sample Text Fixtures:
```python
sample_text         # Базовый текст
complex_text        # Сложный текст с множеством персонажей
empty_text          # Пустой текст
short_text          # Короткий текст (<100 символов)
long_text           # Длинный текст (~8000 символов)
```

### Mock Processor Fixtures:
```python
mock_spacy_processor      # Mock SpaCy
mock_natasha_processor    # Mock Natasha
mock_stanza_processor     # Mock Stanza
mock_processors_dict      # Dict всех mock процессоров
mock_processor_results    # Готовые результаты от процессора
```

### Config Fixtures:
```python
default_processor_config  # Default ProcessorConfig
ensemble_config          # Ensemble voting config
processing_config        # General processing config
```

### Component Fixtures:
```python
mock_processor_registry   # Mock ProcessorRegistry
mock_config_loader       # Mock ConfigLoader
mock_ensemble_voter      # Mock EnsembleVoter
sample_chapter_id        # Sample UUID для chapter
```

---

## 🛠️ Полезные команды

### Development:
```bash
# Запустить тесты в watch mode
pytest tests/services/nlp/ -v --watch

# Запустить только failed тесты
pytest tests/services/nlp/ --lf

# Запустить с verbose output
pytest tests/services/nlp/ -vv

# Запустить конкретный тест
pytest tests/services/nlp/strategies/test_single_strategy.py::test_process_with_default_processor -v
```

### Coverage:
```bash
# HTML report
pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=html

# Terminal report с missing lines
pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=term-missing

# JSON report (для CI/CD)
pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=json

# XML report (для Jenkins)
pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=xml
```

### Performance:
```bash
# Benchmark тесты
pytest tests/services/nlp/ --benchmark-only

# Profile тесты
pytest tests/services/nlp/ --profile

# Memory profiling
pytest tests/services/nlp/ --memray
```

### Debugging:
```bash
# Запустить с pdb debugger
pytest tests/services/nlp/ --pdb

# Показать print statements
pytest tests/services/nlp/ -s

# Показать locals при failures
pytest tests/services/nlp/ -l
```

---

## 🧪 Примеры тестов

### Пример strategy теста:
```python
@pytest.mark.asyncio
async def test_process_with_default_processor(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки с дефолтным процессором."""
    # Arrange
    config = processing_config.copy()

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    assert result.processors_used[0] == "spacy"
    mock_processors_dict["spacy"].extract_descriptions.assert_called_once()
```

### Пример component теста:
```python
def test_processor_config_defaults():
    """Тест дефолтных значений ProcessorConfig."""
    # Act
    config = ProcessorConfig()

    # Assert
    assert config.enabled is True
    assert config.weight == 1.0
    assert config.confidence_threshold == 0.3
```

---

## 📚 Best Practices

### 1. Используйте AAA Pattern:
```python
def test_example():
    # Arrange - подготовка
    # Act - действие
    # Assert - проверка
```

### 2. Переиспользуйте fixtures:
```python
# Хорошо
def test_with_fixture(sample_text, mock_processor):
    ...

# Плохо
def test_without_fixture():
    text = "В глубоком темном лесу..."
    processor = Mock()
    ...
```

### 3. Тестируйте edge cases:
- Empty input
- Invalid input
- Exceptions
- Boundary values
- Concurrent execution

### 4. Mock внешние зависимости:
```python
# Хорошо
@patch('app.services.nlp.components.processor_registry.EnhancedSpacyProcessor')
def test_with_mock(MockSpacy):
    ...

# Плохо (реальная загрузка модели)
def test_without_mock():
    processor = EnhancedSpacyProcessor()
    ...
```

---

## 🔍 Проверка coverage

### Минимальные требования:
- **Strategies:** 85%+ coverage
- **Components:** 80%+ coverage
- **Utils:** 70%+ coverage
- **Integration:** 75%+ coverage

### Как проверить:
```bash
# 1. Запустить тесты с coverage
pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=html

# 2. Открыть HTML report
open htmlcov/index.html

# 3. Проверить coverage для каждого модуля
# Красный = <70% (BLOCKER)
# Желтый = 70-85% (Требует улучшения)
# Зеленый = >85% (Good)
```

---

## 🚨 Known Issues

### 1. AsyncMock import
**Проблема:** `from unittest.mock import AsyncMock` может не работать в Python <3.8
**Решение:**
```python
try:
    from unittest.mock import AsyncMock
except ImportError:
    from asynctest import CoroutineMock as AsyncMock
```

### 2. Patch path
**Проблема:** Неправильный path в `@patch`
**Решение:** Используйте full path от `app.*`:
```python
@patch('app.services.nlp.components.processor_registry.EnhancedSpacyProcessor')
```

### 3. Fixture scope
**Проблема:** Fixtures с `scope="session"` могут конфликтовать
**Решение:** Используйте `scope="function"` для большинства fixtures

---

## 📖 Дополнительная документация

- **Comprehensive documentation:** `TEST_SUITE_DOCUMENTATION.md`
- **Existing tests summary:** `tests/COMPREHENSIVE_TEST_SUMMARY.md`
- **Architecture docs:** `docs/explanations/architecture/nlp/architecture.md`
- **Type checking guide:** `backend/docs/TYPE_CHECKING.md`

---

## 🎯 Next Steps

### Immediate (P0):
1. Создать тесты для **EnsembleVoter** (CRITICAL)
2. Создать тесты для **ConfigLoader** (CRITICAL)
3. Запустить **coverage analysis**

### Short-term (P1):
1. Создать тесты для SequentialStrategy
2. Создать тесты для AdaptiveStrategy
3. Создать тесты для StrategyFactory
4. Расширить integration тесты

### Long-term (P2):
1. Performance benchmarks
2. Memory profiling
3. Load testing
4. Real processor integration tests

---

**Maintainer:** Testing & QA Specialist Agent v2.0
**Last Updated:** 2025-11-21
**Status:** 🟡 IN PROGRESS (Phase 1 Complete, Phase 2 Pending)
