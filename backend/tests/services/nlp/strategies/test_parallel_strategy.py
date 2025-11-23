"""
Тесты для ParallelStrategy - параллельная обработка несколькими процессорами.

Тестируем:
- Параллельное выполнение нескольких процессоров
- max_parallel_processors ограничение
- Обработка исключений от процессоров
- Объединение и дедупликация результатов
- Расчет quality metrics для каждого процессора
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock

from app.services.nlp.strategies.parallel_strategy import ParallelStrategy
from app.services.nlp.strategies.base_strategy import ProcessingResult


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def parallel_strategy():
    """Fixture для ParallelStrategy."""
    return ParallelStrategy()


# ============================================================================
# TESTS: Successful Parallel Processing
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_all_processors(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест параллельной обработки всеми доступными процессорами."""
    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    assert len(result.processors_used) == 3  # spacy, natasha, stanza
    assert "spacy" in result.processors_used
    assert "natasha" in result.processors_used
    assert "stanza" in result.processors_used

    # Все процессоры должны быть вызваны
    for processor in mock_processors_dict.values():
        processor.extract_descriptions.assert_called_once()


@pytest.mark.asyncio
async def test_process_with_selected_processors(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки с выбранными процессорами."""
    # Arrange
    config = processing_config.copy()
    config["selected_processors"] = ["spacy", "natasha"]

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert len(result.processors_used) == 2
    assert "spacy" in result.processors_used
    assert "natasha" in result.processors_used
    mock_processors_dict["spacy"].extract_descriptions.assert_called_once()
    mock_processors_dict["natasha"].extract_descriptions.assert_called_once()
    mock_processors_dict["stanza"].extract_descriptions.assert_not_called()


@pytest.mark.asyncio
async def test_process_with_max_parallel_processors_limit(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест ограничения max_parallel_processors."""
    # Arrange
    config = processing_config.copy()
    config["max_parallel_processors"] = 2

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert len(result.processors_used) <= 2


# ============================================================================
# TESTS: Combining Results
# ============================================================================

@pytest.mark.asyncio
async def test_process_combines_descriptions_from_all_processors(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест объединения описаний от всех процессоров."""
    # Arrange
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {"content": "лес", "type": "location", "priority_score": 0.8, "source": "proc1"}
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {"content": "Иван", "type": "character", "priority_score": 0.9, "source": "proc2"}
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.85)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 2  # Оба описания должны быть
    assert len(result.processor_results) == 2


@pytest.mark.asyncio
async def test_process_deduplicates_similar_descriptions(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест дедупликации похожих описаний от разных процессоров."""
    # Arrange
    duplicate_desc = {
        "content": "темный лес",
        "type": "location",
        "priority_score": 0.8,
    }

    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {**duplicate_desc, "priority_score": 0.85, "source": "proc1"}
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {**duplicate_desc, "priority_score": 0.80, "source": "proc2"}
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.70)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 1  # Дедуплицировано до 1
    assert result.descriptions[0]["priority_score"] == 0.85  # Higher score


# ============================================================================
# TESTS: Error Handling
# ============================================================================

@pytest.mark.asyncio
async def test_process_handles_processor_exception(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки исключения от одного из процессоров."""
    # Arrange
    mock_proc_success = AsyncMock()
    mock_proc_success.extract_descriptions = AsyncMock(return_value=[
        {"content": "лес", "type": "location", "priority_score": 0.8, "source": "success"}
    ])
    mock_proc_success._calculate_quality_score = Mock(return_value=0.75)

    mock_proc_error = AsyncMock()
    mock_proc_error.extract_descriptions = AsyncMock(
        side_effect=Exception("Processor crashed")
    )

    processors = {
        "success": mock_proc_success,
        "error": mock_proc_error
    }

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) >= 0  # Должно обработаться без падения
    assert "success" in result.processor_results
    assert "error" in result.processor_results
    assert result.processor_results["error"] == []  # Пустой результат для ошибки
    assert result.quality_metrics["error"] == 0.0


@pytest.mark.asyncio
async def test_process_handles_all_processors_failing(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки когда все процессоры падают с ошибкой."""
    # Arrange
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(side_effect=Exception("Error 1"))

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(side_effect=Exception("Error 2"))

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 0
    assert all(score == 0.0 for score in result.quality_metrics.values())


# ============================================================================
# TESTS: Quality Metrics
# ============================================================================

@pytest.mark.asyncio
async def test_process_calculates_quality_metrics_for_each_processor(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест расчета quality metrics для каждого процессора."""
    # Arrange
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc1", "type": "location", "priority_score": 0.8}
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc2", "type": "character", "priority_score": 0.9}
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.85)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert "proc1" in result.quality_metrics
    assert "proc2" in result.quality_metrics
    assert result.quality_metrics["proc1"] == 0.75
    assert result.quality_metrics["proc2"] == 0.85


# ============================================================================
# TESTS: Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_empty_processors_dict(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки при отсутствии процессоров."""
    # Arrange
    processors = {}

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 0
    assert len(result.processors_used) == 0
    assert "No NLP processors available" in result.recommendations


@pytest.mark.asyncio
async def test_process_with_empty_text(
    parallel_strategy,
    empty_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки пустого текста."""
    # Arrange
    for processor in mock_processors_dict.values():
        processor.extract_descriptions = AsyncMock(return_value=[])

    # Act
    result = await parallel_strategy.process(
        text=empty_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 0


@pytest.mark.asyncio
async def test_process_with_nonexistent_selected_processor(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки когда выбран несуществующий процессор."""
    # Arrange
    config = processing_config.copy()
    config["selected_processors"] = ["nonexistent", "spacy"]

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    # Должен обработаться только spacy
    assert "spacy" in result.processors_used
    mock_processors_dict["spacy"].extract_descriptions.assert_called_once()


# ============================================================================
# TESTS: Performance & Concurrency
# ============================================================================

@pytest.mark.asyncio
async def test_process_runs_truly_parallel(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест что процессоры действительно выполняются параллельно."""
    # Arrange
    execution_order = []

    async def mock_extract_with_delay(name, delay, text, chapter_id):
        execution_order.append(f"{name}_start")
        await asyncio.sleep(delay)
        execution_order.append(f"{name}_end")
        return [{"content": f"desc_{name}", "type": "location", "priority_score": 0.8}]

    async def proc1_side_effect(text, chapter_id):
        return await mock_extract_with_delay("proc1", 0.1, text, chapter_id)

    async def proc2_side_effect(text, chapter_id):
        return await mock_extract_with_delay("proc2", 0.1, text, chapter_id)

    mock_proc1 = Mock()
    mock_proc1.extract_descriptions = AsyncMock(side_effect=proc1_side_effect)
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = Mock()
    mock_proc2.extract_descriptions = AsyncMock(side_effect=proc2_side_effect)
    mock_proc2._calculate_quality_score = Mock(return_value=0.75)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    result = await parallel_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    # Если параллельное выполнение, должны увидеть start обоих до первого end
    assert execution_order.index("proc2_start") < execution_order.index("proc1_end")


@pytest.mark.asyncio
async def test_process_result_structure(
    parallel_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест правильной структуры результата."""
    # Act
    result = await parallel_strategy.process(
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
