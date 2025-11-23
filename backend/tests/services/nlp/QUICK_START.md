# Quick Start - NLP Architecture Tests

**Fast setup guide для запуска тестов**

---

## 🚀 1. Setup Environment

```bash
# 1. Перейти в backend директорию
cd /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend

# 2. Активировать virtual environment (если есть)
source venv/bin/activate  # или conda activate <env>

# 3. Установить dependencies (если не установлены)
pip install -r requirements.txt

# 4. Установить pytest (если не установлен)
pip install pytest pytest-asyncio pytest-cov
```

---

## ✅ 2. Run Tests

### Запустить все NLP тесты:
```bash
pytest tests/services/nlp/ -v
```

### Запустить с coverage:
```bash
pytest tests/services/nlp/ -v --cov=app/services/nlp --cov-report=html
```

### Открыть coverage report:
```bash
open htmlcov/index.html
```

---

## 📊 3. Expected Results

### Phase 1 Tests (73 тестов):

**Strategies (57 тестов):**
- ✅ `test_base_strategy.py` - 12 тестов
- ✅ `test_single_strategy.py` - 15 тестов
- ✅ `test_parallel_strategy.py` - 16 тестов
- ✅ `test_ensemble_strategy.py` - 14 тестов

**Components (10 тестов):**
- ✅ `test_processor_registry.py` - 10 тестов

**Utils (6 тестов):**
- ✅ Existing tests (уже были)

### Expected Output:
```
tests/services/nlp/strategies/test_base_strategy.py::test_processing_result_initialization PASSED
tests/services/nlp/strategies/test_base_strategy.py::test_processing_result_empty PASSED
tests/services/nlp/strategies/test_base_strategy.py::test_processing_strategy_is_abstract PASSED
...
======================== 73 passed in 5.23s ========================
```

### Expected Coverage:
```
Name                                    Stmts   Miss  Cover
-----------------------------------------------------------
app/services/nlp/strategies/base_strategy.py      45      4    91%
app/services/nlp/strategies/single_strategy.py    32      2    94%
app/services/nlp/strategies/parallel_strategy.py  48      5    90%
app/services/nlp/strategies/ensemble_strategy.py  42      6    86%
app/services/nlp/components/processor_registry.py 98     30    69%
-----------------------------------------------------------
TOTAL                                   265     47    82%
```

---

## 🔧 4. Troubleshooting

### Проблема: ModuleNotFoundError
```bash
ModuleNotFoundError: No module named 'app'
```
**Решение:**
```bash
# Убедитесь что вы в backend директории
cd /Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend

# Добавьте backend в PYTHONPATH
export PYTHONPATH=$PYTHONPATH:/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend
```

### Проблема: Import errors для NLP models
```bash
ImportError: cannot import name 'EnhancedSpacyProcessor'
```
**Решение:** Это нормально для unit tests, они мокируют процессоры
```bash
# Проверьте что моки работают
grep -r "mock_spacy_processor" tests/services/nlp/
```

### Проблема: AsyncMock not found
```bash
ImportError: cannot import name 'AsyncMock'
```
**Решение:**
```bash
# Python 3.7 и ниже
pip install asynctest

# Python 3.8+
# AsyncMock должен быть в stdlib
```

### Проблема: Slow test execution
```bash
# Слишком долго выполняются
```
**Решение:**
```bash
# Запустить только быстрые тесты
pytest tests/services/nlp/ -v -m "not slow"

# Или параллельно
pip install pytest-xdist
pytest tests/services/nlp/ -v -n auto
```

---

## 📝 5. Common Commands

### Development:
```bash
# Watch mode (перезапуск при изменениях)
pytest tests/services/nlp/ -v --watch

# Только failed tests
pytest tests/services/nlp/ --lf

# Stop on first failure
pytest tests/services/nlp/ -x

# Verbose output
pytest tests/services/nlp/ -vv
```

### Coverage:
```bash
# HTML report
pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=html

# Terminal report
pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=term-missing

# Minimum coverage threshold (fail if <80%)
pytest tests/services/nlp/ --cov=app/services/nlp --cov-fail-under=80
```

### Debugging:
```bash
# С pdb debugger
pytest tests/services/nlp/ --pdb

# Показать print statements
pytest tests/services/nlp/ -s

# Показать locals при failures
pytest tests/services/nlp/ -l
```

### Specific Tests:
```bash
# Один файл
pytest tests/services/nlp/strategies/test_single_strategy.py -v

# Один тест
pytest tests/services/nlp/strategies/test_single_strategy.py::test_process_with_default_processor -v

# Тесты по keyword
pytest tests/services/nlp/ -k "single" -v
pytest tests/services/nlp/ -k "processor_registry" -v
```

---

## 🎯 6. Next Steps

### После успешного запуска Phase 1 тестов:

1. **Проверить coverage:**
   ```bash
   pytest tests/services/nlp/ --cov=app/services/nlp --cov-report=html
   open htmlcov/index.html
   ```

2. **Найти модули с низким coverage:**
   - EnsembleVoter: 0% (CRITICAL)
   - ConfigLoader: 0% (CRITICAL)
   - AdaptiveStrategy: 0%

3. **Создать тесты для CRITICAL модулей:**
   - `test_ensemble_voter.py` (~20 тестов)
   - `test_config_loader.py` (~15 тестов)

4. **Запустить все тесты снова:**
   ```bash
   pytest tests/services/nlp/ -v --cov=app/services/nlp --cov-report=html
   ```

5. **Проверить target coverage (80%+):**
   - Если <80% → написать больше тестов
   - Если ≥80% → готово для интеграции

---

## 📚 7. Documentation

**Quick guides:**
- This file: `QUICK_START.md`
- Main README: `README.md`

**Comprehensive docs:**
- Full documentation: `TEST_SUITE_DOCUMENTATION.md`
- Summary report: `TEST_SUMMARY_REPORT.md`

**Code:**
- Test files: `strategies/`, `components/`, `utils/`
- Fixtures: `conftest.py`

---

## 🆘 8. Help

### Если тесты не запускаются:
1. Проверьте Python версию: `python --version` (требуется 3.8+)
2. Проверьте pytest: `pytest --version`
3. Проверьте dependencies: `pip list | grep pytest`
4. Проверьте PYTHONPATH: `echo $PYTHONPATH`

### Если тесты падают:
1. Читайте error messages внимательно
2. Проверьте imports в test файлах
3. Убедитесь что моки настроены правильно
4. Используйте `pytest -vv --tb=long` для детального traceback

### Если coverage низкий:
1. Откройте HTML report: `open htmlcov/index.html`
2. Найдите uncovered lines (красные)
3. Напишите тесты для этих lines
4. Перезапустите coverage

---

## 💡 9. Tips & Tricks

### Tip 1: Используйте fixtures
```python
def test_with_fixture(sample_text, mock_processor):
    # Гораздо чище чем создавать каждый раз
    result = await process(sample_text, mock_processor)
    assert result
```

### Tip 2: Именуйте тесты описательно
```python
# Хорошо ✅
def test_process_with_empty_text_returns_empty_result():
    ...

# Плохо ❌
def test_process():
    ...
```

### Tip 3: Один assert на концепт
```python
# Хорошо ✅
def test_result_has_correct_processors():
    assert result.processors_used == ["spacy"]

def test_result_has_descriptions():
    assert len(result.descriptions) > 0

# Плохо ❌ (если первый assert падает, второй не выполнится)
def test_result():
    assert result.processors_used == ["spacy"]
    assert len(result.descriptions) > 0
```

### Tip 4: Используйте parametrize для похожих тестов
```python
@pytest.mark.parametrize("processor_name,expected", [
    ("spacy", True),
    ("natasha", True),
    ("nonexistent", False)
])
def test_processor_availability(processor_name, expected):
    assert registry.has_processor(processor_name) == expected
```

---

**Good luck with testing! 🚀**

**Questions?** См. `TEST_SUITE_DOCUMENTATION.md` для детальной информации
