# Отчет: Исправление async mock проблем в NLP стратегиях

**Дата:** 2025-11-23
**Статус:** ✅ ЗАВЕРШЕНО
**Результат:** 10/10 ошибочных тестов исправлены, 138/138 тестов стратегий проходят

## Проблема

В тестах NLP стратегий было 10 падений с ошибкой:
```
RuntimeWarning: coroutine 'AsyncMockMixin._execute_mock_call' was never awaited
```

**Ошибочные тесты (AdaptiveStrategy):**
1. `test_process_delegates_to_parallel_for_medium_text`
2. `test_process_delegates_to_ensemble_for_complex_text`
3. `test_process_with_three_processors_uses_ensemble`
4. `test_process_preserves_config_parameters`
5. `test_process_adds_adaptive_recommendation`
6. `test_process_includes_complexity_score_in_recommendation`
7. `test_process_with_empty_text`
8. `test_process_result_structure`

**Ошибочные тесты (EnsembleStrategy):**
9. `test_process_with_ensemble_voter`
10. `test_process_voter_receives_processor_results`

## Основная причина

В файле `backend/tests/services/nlp/conftest.py` mock-объекты процессоров были созданы неправильно:

```python
# ❌ НЕПРАВИЛЬНО
processor = AsyncMock()  # Делает ВСЕ методы async
processor.extract_descriptions = AsyncMock(return_value=[...])
# Теперь _calculate_quality_score тоже async, но он должен быть sync!
```

Проблема: когда вы используете `AsyncMock()` для класса, ВСЕ его методы становятся async-mocks, даже синхронные. Затем код вызывает `processors[name]._calculate_quality_score(descriptions)` - синхронный вызов async метода создает корутину, которая не awaited.

## Решение

### Шаг 1: Исправлены fixtures в conftest.py

**До (неправильно):**
```python
@pytest.fixture
def mock_spacy_processor():
    processor = AsyncMock()  # ❌ Все методы async
    processor.extract_descriptions = AsyncMock(return_value=[...])
    return processor
```

**После (правильно):**
```python
@pytest.fixture
def mock_spacy_processor():
    processor = Mock()  # ✅ Обычный Mock
    processor.extract_descriptions = AsyncMock(return_value=[...])  # ✅ Только async методы
    processor._calculate_quality_score = Mock(return_value=0.85)  # ✅ Синхронный Mock
    return processor
```

**Применено к:**
- `mock_spacy_processor` (строки 101-121)
- `mock_natasha_processor` (строки 124-143)
- `mock_stanza_processor` (строки 146-165)

### Шаг 2: Исправлен тест параллельной обработки

В файле `backend/tests/services/nlp/strategies/test_parallel_strategy.py` был проблемный тест `test_process_runs_truly_parallel` (строка 403).

**Проблема:** lambda функция не возвращает awaitable правильно при использовании в side_effect.

**Решение:** Использовать явно определенные async функции вместо lambda:

```python
async def mock_extract_with_delay(name, delay, text, chapter_id):
    execution_order.append(f"{name}_start")
    await asyncio.sleep(delay)
    execution_order.append(f"{name}_end")
    return [...]

async def proc1_side_effect(text, chapter_id):
    return await mock_extract_with_delay("proc1", 0.1, text, chapter_id)

mock_proc1 = Mock()  # ✅ Не AsyncMock!
mock_proc1.extract_descriptions = AsyncMock(side_effect=proc1_side_effect)
```

## Результаты

### Статистика тестов

**До исправления:**
- ❌ 10 тестов падали с RuntimeWarning
- ⚠️ Async mocks не были корректно awaited

**После исправления:**
- ✅ 138/138 тестов стратегий проходят (100%)
- ✅ 0 RuntimeWarning об unawaited coroutines
- ✅ Все 10 целевых тестов теперь pass

### Команды для проверки

```bash
# Запуск 10 исправленных тестов
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_delegates_to_parallel_for_medium_text \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_delegates_to_ensemble_for_complex_text \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_with_three_processors_uses_ensemble \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_preserves_config_parameters \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_adds_adaptive_recommendation \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_includes_complexity_score_in_recommendation \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_with_empty_text \
  /app/tests/services/nlp/strategies/test_adaptive_strategy.py::test_process_result_structure \
  /app/tests/services/nlp/strategies/test_ensemble_strategy.py::test_process_with_ensemble_voter \
  /app/tests/services/nlp/strategies/test_ensemble_strategy.py::test_process_voter_receives_processor_results \
  -v

# Запуск всех тестов стратегий (138 тестов)
docker-compose exec -T backend pytest /app/tests/services/nlp/strategies/ -v

# Проверка на наличие RuntimeWarning
docker-compose exec -T backend pytest /app/tests/services/nlp/strategies/ -v 2>&1 | grep -i "unawaited"
```

## Файлы изменены

1. **`backend/tests/services/nlp/conftest.py`**
   - Исправлены fixtures: `mock_spacy_processor`, `mock_natasha_processor`, `mock_stanza_processor`
   - Изменены `AsyncMock()` на `Mock()` для базовых процессоров
   - Добавлены явные `_calculate_quality_score` методы с правильными типами

2. **`backend/tests/services/nlp/strategies/test_parallel_strategy.py`**
   - Исправлен тест `test_process_runs_truly_parallel` (строки 403-445)
   - Заменены lambda функции на явно определенные async функции
   - Изменены `AsyncMock()` на `Mock()` для базовых объектов

## Ключевые уроки

**✓ Правило: Используйте правильный тип Mock**

```python
# Для объектов с async методами:
processor = Mock()  # Базовый Mock
processor.async_method = AsyncMock(return_value=data)  # Async методы
processor.sync_method = Mock(return_value=data)  # Sync методы

# ❌ Никогда не делайте:
processor = AsyncMock()  # Это сделает ВСЕ методы async!
```

**✓ Правило: Используйте явные async функции в side_effect**

```python
# ✅ ПРАВИЛЬНО
async def my_side_effect(arg):
    await asyncio.sleep(0.1)
    return result

mock.method = AsyncMock(side_effect=my_side_effect)

# ❌ НЕПРАВИЛЬНО
mock.method = AsyncMock(side_effect=lambda x: async_function(x))  # Lambda не async!
```

## Проверка качества

- ✅ Все целевые тесты pass
- ✅ Нет RuntimeWarning
- ✅ Нет новых падений в других тестах
- ✅ Совместимость с существующими тестами
- ✅ Соответствие Python asyncio best practices

---

**Результат:** УСПЕШНО ЗАВЕРШЕНО
**Готово к:** Следующей P0 задаче (Feature Flag Safety)
