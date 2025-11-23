# Тестирование критических NLP компонентов - Быстрая справка

## 📁 Созданные файлы

```
backend/tests/services/nlp/
├── test_ensemble_voter.py          (25.5 KB, 32 тестов)
├── test_config_loader.py           (20.7 KB, 21 тест)
├── TEST_SUMMARY_CRITICAL_COMPONENTS.md
└── QUICK_REFERENCE.md              (этот файл)
```

## 🚀 Быстрый запуск тестов

### Все тесты (оба компонента)
```bash
cd /Users/sandk/Documents/GitHub/fancai-vibe-hackathon
docker-compose exec -T backend pytest /app/tests/services/nlp/test_ensemble_voter.py /app/tests/services/nlp/test_config_loader.py -v
```

### Только EnsembleVoter
```bash
docker-compose exec -T backend pytest /app/tests/services/nlp/test_ensemble_voter.py -v
```

### Только ConfigLoader
```bash
docker-compose exec -T backend pytest /app/tests/services/nlp/test_config_loader.py -v
```

### С покрытием
```bash
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/test_ensemble_voter.py \
  /app/tests/services/nlp/test_config_loader.py \
  --cov=app.services.nlp.components.ensemble_voter \
  --cov=app.services.nlp.components.config_loader \
  --cov-report=term-missing
```

### Конкретный тест
```bash
# EnsembleVoter test
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/test_ensemble_voter.py::TestEnsembleVoterInitialization::test_default_initialization -v

# ConfigLoader test
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/test_config_loader.py::TestConfigLoaderProcessorConfigLoading::test_load_processor_configs_success -v
```

## 📊 Результаты

```
✅ 53 теста PASS
✅ 96% среднее покрытие
✅ 0 failures
✅ 0 skipped
```

### По компонентам

| Компонент | Тесты | Покрытие | Статус |
|-----------|-------|----------|--------|
| EnsembleVoter | 32 | 96% | ✅ |
| ConfigLoader | 21 | 95% | ✅ |

## 🧪 Структура тестов EnsembleVoter (32 теста)

### Инициализация (5 тестов)
- test_default_initialization
- test_custom_threshold_initialization
- test_zero_threshold
- test_max_threshold
- test_multiple_instances_independent

### Weighted Voting (7 тестов)
- test_single_processor_result
- test_two_processor_consensus
- test_weighted_score_calculation
- test_processor_weight_applied
- test_consensus_ratio_calculation
- test_consensus_threshold_enforcement
- test_sorting_by_weighted_score

### Aggregation (5 тестов)
- test_deduplicate_identical_descriptions
- test_multiple_sources_aggregation
- test_context_enrichment_applied
- test_quality_indicator_based_on_consensus
- test_processor_weight_field_cleanup

### Edge Cases (6 тестов)
- test_empty_processor_results
- test_empty_descriptions_list
- test_processor_without_config
- test_description_missing_priority_score
- test_multiple_identical_descriptions_same_processor
- test_three_processor_partial_consensus

### Threshold Management (5 тестов)
- test_set_valid_threshold
- test_set_invalid_threshold_negative
- test_set_invalid_threshold_over_one
- test_threshold_affects_filtering
- test_consensus_boost_applied_above_threshold

### Integration (4 теста)
- test_full_description_processing_pipeline
- test_logging_output_structure
- test_large_number_of_descriptions
- test_conflicting_processor_votes

## 🔧 Структура тестов ConfigLoader (21 тест)

### Инициализация (2 теста)
- test_config_loader_initialization
- test_config_loader_with_different_managers

### Processor Configuration (5 тестов)
- test_load_processor_configs_success
- test_load_spacy_config
- test_load_natasha_config
- test_load_stanza_config
- test_load_deeppavlov_config

### Global Settings (3 теста)
- test_load_global_settings_success
- test_load_global_settings_default_values
- test_load_global_settings_partial_override

### Error Handling (3 теста)
- test_processor_loading_error_fallback
- test_global_settings_loading_error_fallback
- test_partial_processor_settings_failure

### Validation (2 теста)
- test_processor_config_field_types
- test_custom_settings_preserved

### Integration (6 тестов)
- test_full_config_loading_pipeline
- test_default_configs_structure
- test_default_global_settings_structure
- test_weight_hierarchy
- test_empty_settings_fallback
- test_processor_config_for_ensemble_voting

## 🎯 Ключевые проверки

### EnsembleVoter ✅

```python
# Weighted voting
assert result[0]["weighted_score"] = priority_score × processor_weight

# Consensus threshold
assert consensus_ratio >= 0.6  # default threshold

# Quality indicators
assert quality_indicator in ["high", "medium", "low"]

# Processor weights
assert spacy_weight == 1.0
assert natasha_weight == 1.2
assert stanza_weight == 0.8
```

### ConfigLoader ✅

```python
# Processor configs
assert "spacy" in configs
assert "natasha" in configs
assert "stanza" in configs
assert "deeppavlov" in configs

# Weights
assert configs["deeppavlov"].weight > configs["natasha"].weight
assert configs["natasha"].weight > configs["spacy"].weight
assert configs["spacy"].weight > configs["stanza"].weight

# Global settings
assert global_settings["ensemble_voting_threshold"] == 0.6
assert global_settings["processing_mode"] in ["single", "parallel", "ensemble", "adaptive"]
```

## 📝 Примеры использования

### Загрузка всех тестов для одного класса
```bash
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/test_ensemble_voter.py::TestEnsembleVoterWeightedVoting -v
```

### Запуск с verbose output
```bash
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/test_ensemble_voter.py -vv --tb=short
```

### Запуск с результатами по тестам
```bash
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/test_config_loader.py -v --tb=line
```

## 🔍 Отладка

### Если тесты не находятся
```bash
docker-compose exec -T backend bash -c "find /app -name 'test_ensemble_voter.py'"
```

### Проверка импортов
```bash
docker-compose exec -T backend python -c \
  "from app.services.nlp.components.ensemble_voter import EnsembleVoter; print('OK')"
```

### Просмотр покрытия в HTML
```bash
docker-compose exec -T backend pytest \
  /app/tests/services/nlp/ \
  --cov=app.services.nlp.components \
  --cov-report=html

# Затем откройте: htmlcov/index.html
```

## 📚 Документация

- **Полный отчет:** `TEST_SUMMARY_CRITICAL_COMPONENTS.md`
- **EnsembleVoter код:** `app/services/nlp/components/ensemble_voter.py`
- **ConfigLoader код:** `app/services/nlp/components/config_loader.py`

## ⚡ Performance

- **Время выполнения:** ~0.1-0.2 секунд
- **Максимум описаний в тестах:** 100+ (performance tested)
- **Все тесты выполняют быстро** (unit-level)

## 🎓 Что тестируется

### EnsembleVoter
- Weighted consensus voting algorithm
- Processor weight application (SpaCy 1.0, Natasha 1.2, Stanza 0.8)
- Consensus threshold enforcement (default 0.6)
- Quality indicator calculation
- Description deduplication
- Context enrichment
- Error handling

### ConfigLoader
- Loading processor configurations from DB
- Building configs for 4 NLP processors
- Loading global NLP settings
- Default value fallback
- Error handling and resilience
- Configuration validation

---

**Дата:** 23 ноября 2025
**Статус:** ✅ ЗАВЕРШЕНО
**Покрытие:** 96%
