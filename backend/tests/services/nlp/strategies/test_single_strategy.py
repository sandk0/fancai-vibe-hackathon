"""
Тесты для SingleStrategy - обработка одним процессором.

Тестируем:
- Успешная обработка с выбранным процессором
- Fallback на первый доступный процессор
- Обработка отсутствия процессоров
- Конфигурация processor_name
- Quality metrics расчет
"""

import pytest
from unittest.mock import AsyncMock, Mock

from app.services.nlp.strategies.single_strategy import SingleStrategy
from app.services.nlp.strategies.base_strategy import ProcessingResult


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def single_strategy():
    """Fixture для SingleStrategy."""
    return SingleStrategy()


# ============================================================================
# TESTS: Successful Processing
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_default_processor(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки с дефолтным процессором (spacy)."""
    # Arrange
    config = processing_config.copy()
    # processor_name не указан, должен использоваться spacy

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    assert len(result.processors_used) == 1
    assert result.processors_used[0] == "spacy"
    assert len(result.descriptions) > 0
    mock_processors_dict["spacy"].extract_descriptions.assert_called_once()


@pytest.mark.asyncio
async def test_process_with_specific_processor(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки с конкретным указанным процессором."""
    # Arrange
    config = processing_config.copy()
    config["processor_name"] = "natasha"

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert result.processors_used[0] == "natasha"
    mock_processors_dict["natasha"].extract_descriptions.assert_called_once()
    mock_processors_dict["spacy"].extract_descriptions.assert_not_called()


@pytest.mark.asyncio
async def test_process_with_default_processor_config(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict
):
    """Тест обработки с default_processor в конфиге."""
    # Arrange
    config = {"default_processor": "stanza"}

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert result.processors_used[0] == "stanza"
    mock_processors_dict["stanza"].extract_descriptions.assert_called_once()


# ============================================================================
# TESTS: Fallback Behavior
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_nonexistent_processor_fallback(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест fallback на первый доступный процессор при несуществующем."""
    # Arrange
    config = processing_config.copy()
    config["processor_name"] = "nonexistent_processor"

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert len(result.processors_used) == 1
    # Должен использоваться первый доступный (порядок dict)
    assert result.processors_used[0] in mock_processors_dict.keys()


@pytest.mark.asyncio
async def test_process_with_empty_processors_dict(
    single_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки при отсутствии процессоров."""
    # Arrange
    processors = {}

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 0
    assert len(result.processors_used) == 0
    assert len(result.recommendations) > 0
    assert "No NLP processors available" in result.recommendations


# ============================================================================
# TESTS: Quality Metrics
# ============================================================================

@pytest.mark.asyncio
async def test_process_calculates_quality_metrics(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_spacy_processor,
    processing_config
):
    """Тест расчета quality metrics."""
    # Arrange
    mock_spacy_processor._calculate_quality_score = Mock(return_value=0.75)
    processors = {"spacy": mock_spacy_processor}

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert "spacy" in result.quality_metrics
    assert result.quality_metrics["spacy"] == 0.75
    mock_spacy_processor._calculate_quality_score.assert_called_once()


# ============================================================================
# TESTS: Result Structure
# ============================================================================

@pytest.mark.asyncio
async def test_process_returns_correct_structure(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест правильной структуры результата."""
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
    assert isinstance(result.descriptions, list)
    assert isinstance(result.processor_results, dict)
    assert isinstance(result.processors_used, list)
    assert isinstance(result.quality_metrics, dict)
    assert isinstance(result.recommendations, list)
    assert isinstance(result.processing_time, float)


@pytest.mark.asyncio
async def test_process_processor_results_matches_descriptions(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что processor_results содержит те же descriptions."""
    # Arrange
    config = processing_config.copy()
    config["processor_name"] = "spacy"

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert "spacy" in result.processor_results
    assert result.processor_results["spacy"] == result.descriptions


# ============================================================================
# TESTS: Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_empty_text(
    single_strategy,
    empty_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки пустого текста."""
    # Arrange
    mock_processors_dict["spacy"].extract_descriptions = AsyncMock(return_value=[])

    # Act
    result = await single_strategy.process(
        text=empty_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 0
    mock_processors_dict["spacy"].extract_descriptions.assert_called_once()


@pytest.mark.asyncio
async def test_process_with_short_text(
    single_strategy,
    short_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки короткого текста."""
    # Arrange
    mock_processors_dict["spacy"].extract_descriptions = AsyncMock(return_value=[])

    # Act
    result = await single_strategy.process(
        text=short_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)


@pytest.mark.asyncio
async def test_process_with_processor_exception(
    single_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки исключения от процессора."""
    # Arrange
    mock_processor = AsyncMock()
    mock_processor.extract_descriptions = AsyncMock(
        side_effect=Exception("Processor error")
    )
    processors = {"spacy": mock_processor}

    # Act & Assert
    with pytest.raises(Exception, match="Processor error"):
        await single_strategy.process(
            text=sample_text,
            chapter_id=sample_chapter_id,
            processors=processors,
            config=processing_config
        )


# ============================================================================
# TESTS: Configuration Variations
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_minimal_config(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict
):
    """Тест обработки с минимальной конфигурацией."""
    # Arrange
    config = {}  # Empty config

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    assert len(result.processors_used) == 1


@pytest.mark.asyncio
async def test_process_processor_name_takes_precedence(
    single_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict
):
    """Тест что processor_name имеет приоритет над default_processor."""
    # Arrange
    config = {
        "processor_name": "natasha",
        "default_processor": "spacy"
    }

    # Act
    result = await single_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert result.processors_used[0] == "natasha"
    mock_processors_dict["natasha"].extract_descriptions.assert_called_once()
