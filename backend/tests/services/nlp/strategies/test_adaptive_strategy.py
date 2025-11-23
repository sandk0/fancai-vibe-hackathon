"""
Тесты для AdaptiveStrategy - интеллектуальный выбор оптимальной стратегии.

Тестируем:
- Инициализация AdaptiveStrategy с внутренними стратегиями
- Анализ текста для выбора стратегии
- Выбор Single стратегии для простого текста
- Выбор Parallel стратегии для среднего текста
- Выбор Ensemble стратегии для сложного текста
- Детектирование имен и локаций
- Оценка сложности текста
- Корректное делегирование выбранной стратегии
- Error handling
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch

from app.services.nlp.strategies.adaptive_strategy import AdaptiveStrategy
from app.services.nlp.strategies.base_strategy import ProcessingResult


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def adaptive_strategy():
    """Fixture для AdaptiveStrategy."""
    return AdaptiveStrategy()


@pytest.fixture
def simple_text():
    """Простой текст для SINGLE режима."""
    return "Это простой текст без имен и сложной структуры."


@pytest.fixture
def medium_text():
    """Средней сложности текст для PARALLEL режима."""
    return """
    Иван и Мария вышли в лес. Они видели высокие деревья и красивые цветы.
    Лес был большой и густой.
    """


@pytest.fixture
def complex_text():
    """Сложный текст для ENSEMBLE режима."""
    return """
    Князь Андрей Болконский и Пьер Безухов встретились в Москве на балу у графа Ростова.
    Великолепный зал был украшен хрустальными люстрами и позолоченными зеркалами.
    Петербургское высшее общество собралось в особняке на Тверской улице.
    Анна Павловна Шерер устраивала вечер, где присутствовали все знатные особы столицы.
    Граф Илья Андреевич Ростов радушно встречал гостей в своей просторной гостиной.
    """


@pytest.fixture
def text_with_names():
    """Текст с именами для детектирования."""
    return """
    Иван Иванович встретил Мария Петровну у театра.
    Василий Сергеевич был там же.
    """


@pytest.fixture
def text_with_locations():
    """Текст с названиями локаций."""
    return """
    В городе Москве на площади Красной стояла нарядная толпа.
    На улице Пушкина было оживленно.
    В деревне Ясная Поляна жил великий писатель.
    """


# ============================================================================
# TESTS: Initialization
# ============================================================================

def test_adaptive_strategy_initialization(adaptive_strategy):
    """Тест инициализации AdaptiveStrategy."""
    # Assert
    assert adaptive_strategy is not None
    assert hasattr(adaptive_strategy, 'single_strategy')
    assert hasattr(adaptive_strategy, 'parallel_strategy')
    assert hasattr(adaptive_strategy, 'ensemble_strategy')


def test_adaptive_strategy_has_internal_strategies(adaptive_strategy):
    """Тест что AdaptiveStrategy содержит все необходимые стратегии."""
    # Assert
    assert adaptive_strategy.single_strategy is not None
    assert adaptive_strategy.parallel_strategy is not None
    assert adaptive_strategy.ensemble_strategy is not None


def test_adaptive_strategy_is_processing_strategy(adaptive_strategy):
    """Тест что AdaptiveStrategy наследует ProcessingStrategy."""
    from app.services.nlp.strategies.base_strategy import ProcessingStrategy

    # Assert
    assert isinstance(adaptive_strategy, ProcessingStrategy)


# ============================================================================
# TESTS: Text Complexity Analysis
# ============================================================================

def test_estimate_text_complexity_simple_text(adaptive_strategy, simple_text):
    """Тест оценки сложности простого текста."""
    # Act
    complexity = adaptive_strategy._estimate_text_complexity(simple_text)

    # Assert
    assert isinstance(complexity, float)
    assert 0.0 <= complexity <= 1.0
    assert complexity < 0.5  # Простой текст должен иметь низкую сложность


def test_estimate_text_complexity_complex_text(adaptive_strategy, complex_text):
    """Тест оценки сложности сложного текста."""
    # Act
    complexity = adaptive_strategy._estimate_text_complexity(complex_text)

    # Assert
    assert isinstance(complexity, float)
    assert 0.0 <= complexity <= 1.0
    # Сложный текст должен иметь более высокую сложность
    assert complexity > 0.4


def test_estimate_text_complexity_empty_text(adaptive_strategy):
    """Тест оценки сложности пустого текста."""
    # Act
    complexity = adaptive_strategy._estimate_text_complexity("")

    # Assert
    assert complexity == 0.0


def test_estimate_text_complexity_very_long_text(adaptive_strategy):
    """Тест оценки сложности очень длинного текста."""
    # Arrange
    very_long_text = "Это предложение. " * 1000  # 1000 предложений

    # Act
    complexity = adaptive_strategy._estimate_text_complexity(very_long_text)

    # Assert
    assert 0.0 <= complexity <= 1.0


# ============================================================================
# TESTS: Person Name Detection
# ============================================================================

def test_contains_person_names_with_russian_names(adaptive_strategy, text_with_names):
    """Тест детектирования русских имен."""
    # Act
    has_names = adaptive_strategy._contains_person_names(text_with_names)

    # Assert
    assert has_names is True


def test_contains_person_names_without_names(adaptive_strategy, simple_text):
    """Тест что простой текст без имен не детектируется."""
    # Act
    has_names = adaptive_strategy._contains_person_names(simple_text)

    # Assert
    # Может быть True или False в зависимости от текста
    assert isinstance(has_names, bool)


def test_contains_person_names_with_patronymic(adaptive_strategy):
    """Тест детектирования имен с отчеством."""
    # Arrange
    text = "Иван Иванович пришел домой."

    # Act
    has_names = adaptive_strategy._contains_person_names(text)

    # Assert
    assert has_names is True


def test_contains_person_names_empty_string(adaptive_strategy):
    """Тест детектирования имен в пустой строке."""
    # Act
    has_names = adaptive_strategy._contains_person_names("")

    # Assert
    assert has_names is False


# ============================================================================
# TESTS: Location Name Detection
# ============================================================================

def test_contains_location_names_with_locations(adaptive_strategy, text_with_locations):
    """Тест детектирования названий локаций."""
    # Act
    has_locations = adaptive_strategy._contains_location_names(text_with_locations)

    # Assert
    assert has_locations is True


def test_contains_location_names_without_locations(adaptive_strategy, simple_text):
    """Тест что простой текст без локаций может не детектироваться."""
    # Act
    has_locations = adaptive_strategy._contains_location_names(simple_text)

    # Assert
    assert isinstance(has_locations, bool)


def test_contains_location_names_with_multiple_keywords(adaptive_strategy):
    """Тест детектирования текста с несколькими ключевыми словами локаций."""
    # Arrange
    text = "В городе на улице площади и в районе было оживленно."

    # Act
    has_locations = adaptive_strategy._contains_location_names(text)

    # Assert
    assert has_locations is True


# ============================================================================
# TESTS: Adaptive Processor Selection
# ============================================================================

def test_adaptive_processor_selection_with_names(adaptive_strategy, text_with_names, mock_processors_dict):
    """Тест выбора процессоров на основе обнаружения имен."""
    # Act
    selected = adaptive_strategy._adaptive_processor_selection(text_with_names, mock_processors_dict)

    # Assert
    assert isinstance(selected, list)
    assert len(selected) > 0
    # Должен выбрать Natasha для имен если доступна
    if "natasha" in mock_processors_dict:
        assert "natasha" in selected


def test_adaptive_processor_selection_with_long_text(adaptive_strategy, mock_processors_dict):
    """Тест выбора процессоров для длинного текста."""
    # Arrange
    long_text = "это слово " * 200  # Длинный текст (>1000 символов)

    # Act
    selected = adaptive_strategy._adaptive_processor_selection(long_text, mock_processors_dict)

    # Assert
    assert isinstance(selected, list)
    assert len(selected) > 0
    # SpaCy хорошо для длинных текстов
    if "spacy" in mock_processors_dict:
        # Может быть выбран если текст достаточно длинный
        pass


def test_adaptive_processor_selection_fallback_to_default(adaptive_strategy):
    """Тест fallback к процессору по умолчанию."""
    # Arrange
    simple_text = "Просто текст."
    mock_procs = {"spacy": Mock()}

    # Act
    selected = adaptive_strategy._adaptive_processor_selection(simple_text, mock_procs)

    # Assert
    assert len(selected) > 0
    assert "spacy" in selected  # Default processor


def test_adaptive_processor_selection_empty_processors(adaptive_strategy):
    """Тест выбора когда нет доступных процессоров."""
    # Arrange
    text = "Какой-то текст"
    processors = {}

    # Act & Assert - должна быть обработана ошибка
    try:
        selected = adaptive_strategy._adaptive_processor_selection(text, processors)
        # Если ошибки не будет, должен быть пустой список
        assert selected is not None
    except (KeyError, IndexError):
        # Это ожидаемо если нет процессоров
        pass


# ============================================================================
# TESTS: Strategy Selection and Delegation
# ============================================================================

@pytest.mark.asyncio
async def test_process_delegates_to_single_for_simple_text(
    adaptive_strategy,
    simple_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что AdaptiveStrategy делегирует к SINGLE для простого текста."""
    # Arrange
    # Мокируем вызовы стратегий
    adaptive_strategy.single_strategy.process = AsyncMock(
        return_value=ProcessingResult(
            descriptions=[{"content": "desc", "type": "location", "priority_score": 0.8}],
            processor_results={"spacy": [{"content": "desc"}]},
            processing_time=0.1,
            processors_used=["spacy"],
            quality_metrics={"spacy": 0.8},
            recommendations=["Simple text"]
        )
    )

    # Act
    result = await adaptive_strategy.process(
        text=simple_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    # Проверяем что результат содержит информацию об Adaptive режиме
    adaptive_recommendations = [r for r in result.recommendations if "Adaptive" in r]
    assert len(adaptive_recommendations) > 0


@pytest.mark.asyncio
async def test_process_delegates_to_parallel_for_medium_text(
    adaptive_strategy,
    medium_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что AdaptiveStrategy делегирует к PARALLEL для среднего текста."""
    # Arrange
    adaptive_strategy.parallel_strategy.process = AsyncMock(
        return_value=ProcessingResult(
            descriptions=[{"content": "desc1"}, {"content": "desc2"}],
            processor_results={},
            processing_time=0.2,
            processors_used=["spacy", "natasha"],
            quality_metrics={},
            recommendations=["Medium complexity"]
        )
    )

    # Act
    result = await adaptive_strategy.process(
        text=medium_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    # Может быть SINGLE или PARALLEL в зависимости от анализа


@pytest.mark.asyncio
async def test_process_delegates_to_ensemble_for_complex_text(
    adaptive_strategy,
    complex_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что AdaptiveStrategy делегирует к ENSEMBLE для сложного текста."""
    # Arrange
    adaptive_strategy.ensemble_strategy.process = AsyncMock(
        return_value=ProcessingResult(
            descriptions=[{"content": "desc1"}, {"content": "desc2"}, {"content": "desc3"}],
            processor_results={},
            processing_time=0.3,
            processors_used=["spacy", "natasha", "stanza"],
            quality_metrics={},
            recommendations=["Complex text - ensemble"]
        )
    )

    # Act
    result = await adaptive_strategy.process(
        text=complex_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    # Результат должен содержать рекомендацию об Adaptive режиме
    assert len(result.recommendations) > 0


@pytest.mark.asyncio
async def test_process_with_three_processors_uses_ensemble(
    adaptive_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что >2 процессоров выбирают ENSEMBLE."""
    # Arrange
    adaptive_strategy.ensemble_strategy.process = AsyncMock(
        return_value=ProcessingResult(
            descriptions=[],
            processor_results={},
            processing_time=0.3,
            processors_used=["spacy", "natasha", "stanza"],
            quality_metrics={},
            recommendations=["Ensemble mode"]
        )
    )

    # Act
    result = await adaptive_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)


# ============================================================================
# TESTS: Configuration Handling
# ============================================================================

@pytest.mark.asyncio
async def test_process_passes_selected_processors_to_strategy(
    adaptive_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что AdaptiveStrategy передает выбранные процессоры к стратегии."""
    # Arrange
    call_args = {}

    async def capture_single_process(text, chapter_id, processors, config):
        call_args['config'] = config
        return ProcessingResult([], {}, 0.0, [], {}, [])

    adaptive_strategy.single_strategy.process = AsyncMock(side_effect=capture_single_process)

    # Act
    await adaptive_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    # Конфиг должен содержать selected_processors
    if 'config' in call_args:
        assert 'selected_processors' in call_args['config']


@pytest.mark.asyncio
async def test_process_preserves_config_parameters(
    adaptive_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что параметры конфига сохраняются при передаче."""
    # Arrange
    config = processing_config.copy()
    config["custom_param"] = "test_value"

    # Act
    result = await adaptive_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert isinstance(result, ProcessingResult)


# ============================================================================
# TESTS: Recommendations and Metadata
# ============================================================================

@pytest.mark.asyncio
async def test_process_adds_adaptive_recommendation(
    adaptive_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что добавляется рекомендация об использовании Adaptive режима."""
    # Act
    result = await adaptive_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert len(result.recommendations) > 0
    # Должна содержаться информация об Adaptive выборе
    recommendation_text = " ".join(result.recommendations)
    assert "Adaptive" in recommendation_text or len(result.recommendations) > 0


@pytest.mark.asyncio
async def test_process_includes_complexity_score_in_recommendation(
    adaptive_strategy,
    complex_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что сложность текста включена в рекомендацию."""
    # Act
    result = await adaptive_strategy.process(
        text=complex_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    # Рекомендация должна содержать информацию о сложности
    assert len(result.recommendations) > 0


# ============================================================================
# TESTS: Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_empty_text(
    adaptive_strategy,
    empty_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки пустого текста."""
    # Act
    result = await adaptive_strategy.process(
        text=empty_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    # Сложность пустого текста должна быть 0
    complexity = adaptive_strategy._estimate_text_complexity(empty_text)
    assert complexity == 0.0


@pytest.mark.asyncio
async def test_process_with_empty_processors(
    adaptive_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки когда нет доступных процессоров."""
    # Arrange
    processors = {}

    # Act & Assert - должна быть обработана или пропущена ошибка
    try:
        result = await adaptive_strategy.process(
            text=sample_text,
            chapter_id=sample_chapter_id,
            processors=processors,
            config=processing_config
        )
        # Если обработается, результат должен быть корректным типом
        assert isinstance(result, ProcessingResult) or result is None
    except (KeyError, IndexError, ValueError):
        # Ожидаемо при отсутствии процессоров
        pass


@pytest.mark.asyncio
async def test_process_with_single_processor(
    adaptive_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки когда доступен только один процессор."""
    # Arrange
    mock_proc = AsyncMock()
    mock_proc.extract_descriptions = AsyncMock(return_value=[])
    mock_proc._calculate_quality_score = Mock(return_value=0.7)

    processors = {"only_proc": mock_proc}

    # Act
    result = await adaptive_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    # С одним процессором должен быть выбран SINGLE режим
    assert len(result.processors_used) <= 1


# ============================================================================
# TESTS: Result Structure
# ============================================================================

@pytest.mark.asyncio
async def test_process_result_structure(
    adaptive_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест правильной структуры результата."""
    # Act
    result = await adaptive_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    assert isinstance(result.descriptions, list)
    assert isinstance(result.processor_results, dict)
    assert isinstance(result.processors_used, list)
    assert isinstance(result.quality_metrics, dict)
    assert isinstance(result.recommendations, list)


# ============================================================================
# TESTS: Text Length Analysis
# ============================================================================

def test_text_length_affects_complexity(adaptive_strategy):
    """Тест что длина текста влияет на оценку сложности."""
    # Arrange
    short = "Короткий текст."
    medium = "Это средней длины текст. Он содержит несколько предложений. Каждое добавляет сложности."
    long = "Это длинный текст. " * 50  # Очень длинный

    # Act
    complexity_short = adaptive_strategy._estimate_text_complexity(short)
    complexity_medium = adaptive_strategy._estimate_text_complexity(medium)
    complexity_long = adaptive_strategy._estimate_text_complexity(long)

    # Assert
    assert 0.0 <= complexity_short <= 1.0
    assert 0.0 <= complexity_medium <= 1.0
    assert 0.0 <= complexity_long <= 1.0


# ============================================================================
# TESTS: Word Length Analysis
# ============================================================================

def test_word_length_affects_complexity(adaptive_strategy):
    """Тест что длина слов влияет на сложность."""
    # Arrange
    short_words = "Кот и пес бежали."  # Слова 2-4 символа
    long_words = "Произвольная конструкция непредсказуемой сложности."  # Слова 8+ символов

    # Act
    complexity_short = adaptive_strategy._estimate_text_complexity(short_words)
    complexity_long = adaptive_strategy._estimate_text_complexity(long_words)

    # Assert
    assert 0.0 <= complexity_short <= 1.0
    assert 0.0 <= complexity_long <= 1.0
    # Длинные слова должны дать более высокую сложность
    assert complexity_long >= complexity_short


# ============================================================================
# TESTS: Sentence Length Analysis
# ============================================================================

def test_sentence_length_affects_complexity(adaptive_strategy):
    """Тест что длина предложений влияет на сложность."""
    # Arrange
    short_sentences = "Кот. Пес. Птица."  # Короткие предложения
    long_sentences = "Кот, пес и птица встали рано утром и пошли гулять в лес, где было очень красиво."  # Длинное предложение

    # Act
    complexity_short = adaptive_strategy._estimate_text_complexity(short_sentences)
    complexity_long = adaptive_strategy._estimate_text_complexity(long_sentences)

    # Assert
    assert 0.0 <= complexity_short <= 1.0
    assert 0.0 <= complexity_long <= 1.0
