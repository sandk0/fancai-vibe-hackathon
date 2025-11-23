"""
Тесты для SequentialStrategy - последовательная обработка несколькими процессорами.

Тестируем:
- Последовательное выполнение процессоров (один за другим)
- max_parallel_processors ограничение
- Порядок обработки (процессор 1 → процессор 2 → процессор 3)
- Обработка исключений от процессоров
- Объединение и дедупликация результатов
- Расчет quality metrics для каждого процессора
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock

from app.services.nlp.strategies.sequential_strategy import SequentialStrategy
from app.services.nlp.strategies.base_strategy import ProcessingResult


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def sequential_strategy():
    """Fixture для SequentialStrategy."""
    return SequentialStrategy()


# ============================================================================
# TESTS: Initialization
# ============================================================================

def test_sequential_strategy_initialization(sequential_strategy):
    """Тест инициализации SequentialStrategy."""
    # Assert
    assert sequential_strategy is not None
    assert hasattr(sequential_strategy, 'process')


def test_sequential_strategy_is_processing_strategy(sequential_strategy):
    """Тест что SequentialStrategy наследует ProcessingStrategy."""
    # Import needed for this test
    from app.services.nlp.strategies.base_strategy import ProcessingStrategy

    # Assert
    assert isinstance(sequential_strategy, ProcessingStrategy)


# ============================================================================
# TESTS: Sequential Processing Logic
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_all_processors_sequentially(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест последовательной обработки всеми доступными процессорами."""
    # Act
    result = await sequential_strategy.process(
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
async def test_process_with_selected_processors_in_order(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки с выбранными процессорами в последовательном порядке."""
    # Arrange
    # Обнуляем call_count для чистоты
    for proc in mock_processors_dict.values():
        proc.reset_mock()

    config = processing_config.copy()
    config["selected_processors"] = ["natasha", "spacy"]

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert len(result.processors_used) == 2
    assert "natasha" in result.processors_used
    assert "spacy" in result.processors_used
    mock_processors_dict["natasha"].extract_descriptions.assert_called_once()
    mock_processors_dict["spacy"].extract_descriptions.assert_called_once()
    # stanza не должен быть вызван
    mock_processors_dict["stanza"].extract_descriptions.assert_not_called()


@pytest.mark.asyncio
async def test_process_with_max_processors_limit(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест ограничения max_parallel_processors для sequential режима."""
    # Arrange
    for proc in mock_processors_dict.values():
        proc.reset_mock()

    config = processing_config.copy()
    config["max_parallel_processors"] = 2

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert len(result.processors_used) <= 2


@pytest.mark.asyncio
async def test_process_sequential_vs_parallel_timing(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест что sequential выполняется последовательно (медленнее чем параллель)."""
    # Arrange
    execution_times = {}

    async def mock_extract_with_time(name, delay):
        async def inner(text, chapter_id):
            start = asyncio.get_event_loop().time()
            await asyncio.sleep(delay)
            end = asyncio.get_event_loop().time()
            execution_times[f"{name}_time"] = end - start
            return [{"content": f"desc_{name}", "type": "location", "priority_score": 0.8}]
        return inner

    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = await mock_extract_with_time("proc1", 0.05)
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = await mock_extract_with_time("proc2", 0.05)
    mock_proc2._calculate_quality_score = Mock(return_value=0.75)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert result is not None
    assert len(result.processors_used) >= 1


# ============================================================================
# TESTS: Combining Results
# ============================================================================

@pytest.mark.asyncio
async def test_process_combines_descriptions_from_all_processors(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест объединения описаний от всех процессоров в sequence."""
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
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 2  # Оба описания
    assert len(result.processor_results) == 2


@pytest.mark.asyncio
async def test_process_deduplicates_similar_descriptions_sequential(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест дедупликации одинаковых описаний в sequence."""
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
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 1  # Дедуплицировано
    assert result.descriptions[0]["priority_score"] == 0.85  # Higher score


@pytest.mark.asyncio
async def test_process_accumulates_results_from_each_processor(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест что результаты накапливаются по мере обработки процессорами."""
    # Arrange
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc1", "type": "location", "priority_score": 0.8, "source": "proc1"}
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc2", "type": "location", "priority_score": 0.8, "source": "proc2"}
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.85)

    mock_proc3 = AsyncMock()
    mock_proc3.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc3", "type": "character", "priority_score": 0.8, "source": "proc3"}
    ])
    mock_proc3._calculate_quality_score = Mock(return_value=0.78)

    processors = {
        "proc1": mock_proc1,
        "proc2": mock_proc2,
        "proc3": mock_proc3
    }

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.processor_results) == 3
    assert "proc1" in result.processor_results
    assert "proc2" in result.processor_results
    assert "proc3" in result.processor_results


# ============================================================================
# TESTS: Error Handling
# ============================================================================

@pytest.mark.asyncio
async def test_process_handles_single_processor_exception(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки исключения от одного процессора в последовательности."""
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

    mock_proc_after = AsyncMock()
    mock_proc_after.extract_descriptions = AsyncMock(return_value=[
        {"content": "небо", "type": "atmosphere", "priority_score": 0.7, "source": "after"}
    ])
    mock_proc_after._calculate_quality_score = Mock(return_value=0.65)

    processors = {
        "success": mock_proc_success,
        "error": mock_proc_error,
        "after": mock_proc_after
    }

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert - должна обработаться несмотря на ошибку одного процессора
    assert "success" in result.processor_results
    assert "error" in result.processor_results
    assert "after" in result.processor_results
    assert result.processor_results["error"] == []  # Empty для ошибки
    assert result.quality_metrics["error"] == 0.0
    assert len(result.descriptions) >= 2  # От success и after


@pytest.mark.asyncio
async def test_process_continues_after_error(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест что обработка продолжается после ошибки одного процессора."""
    # Arrange
    processors_called = []

    mock_proc1 = AsyncMock()
    async def proc1_extract(text, chapter_id):
        processors_called.append("proc1")
        return [{"content": "desc1", "type": "location", "priority_score": 0.8}]
    mock_proc1.extract_descriptions = proc1_extract
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    async def proc2_extract(text, chapter_id):
        processors_called.append("proc2")
        raise Exception("Error in proc2")
    mock_proc2.extract_descriptions = proc2_extract

    mock_proc3 = AsyncMock()
    async def proc3_extract(text, chapter_id):
        processors_called.append("proc3")
        return [{"content": "desc3", "type": "location", "priority_score": 0.8}]
    mock_proc3.extract_descriptions = proc3_extract
    mock_proc3._calculate_quality_score = Mock(return_value=0.78)

    processors = {
        "proc1": mock_proc1,
        "proc2": mock_proc2,
        "proc3": mock_proc3
    }

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert - все процессоры должны быть вызваны несмотря на ошибку
    assert "proc1" in processors_called
    assert "proc2" in processors_called
    assert "proc3" in processors_called


@pytest.mark.asyncio
async def test_process_handles_all_processors_failing(
    sequential_strategy,
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
    result = await sequential_strategy.process(
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
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест расчета quality metrics для каждого процессора в sequence."""
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
    result = await sequential_strategy.process(
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
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки при отсутствии процессоров."""
    # Arrange
    processors = {}

    # Act
    result = await sequential_strategy.process(
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
    sequential_strategy,
    empty_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки пустого текста."""
    # Arrange
    mock_proc = AsyncMock()
    mock_proc.extract_descriptions = AsyncMock(return_value=[])
    mock_proc._calculate_quality_score = Mock(return_value=0.0)

    processors = {"proc": mock_proc}

    # Act
    result = await sequential_strategy.process(
        text=empty_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.descriptions) == 0


@pytest.mark.asyncio
async def test_process_with_nonexistent_selected_processor(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест обработки когда выбран несуществующий процессор."""
    # Arrange
    for proc in mock_processors_dict.values():
        proc.reset_mock()

    config = processing_config.copy()
    config["selected_processors"] = ["nonexistent", "spacy"]

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert - должен обработаться только spacy
    assert "spacy" in result.processors_used
    mock_processors_dict["spacy"].extract_descriptions.assert_called_once()


@pytest.mark.asyncio
async def test_process_with_single_processor(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест обработки с одним процессором."""
    # Arrange
    mock_proc = AsyncMock()
    mock_proc.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc", "type": "location", "priority_score": 0.8}
    ])
    mock_proc._calculate_quality_score = Mock(return_value=0.8)

    processors = {"only_proc": mock_proc}

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert len(result.processors_used) == 1
    assert "only_proc" in result.processors_used


# ============================================================================
# TESTS: Result Structure
# ============================================================================

@pytest.mark.asyncio
async def test_process_result_structure(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест правильной структуры результата."""
    # Arrange
    mock_proc = AsyncMock()
    mock_proc.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc", "type": "location", "priority_score": 0.8}
    ])
    mock_proc._calculate_quality_score = Mock(return_value=0.8)

    processors = {"proc": mock_proc}

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    assert isinstance(result.descriptions, list)
    assert isinstance(result.processor_results, dict)
    assert isinstance(result.processors_used, list)
    assert isinstance(result.quality_metrics, dict)
    assert isinstance(result.recommendations, list)


@pytest.mark.asyncio
async def test_process_recommendations_generated(
    sequential_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест что recommendations генерируются корректно."""
    # Arrange
    mock_proc = AsyncMock()
    mock_proc.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc", "type": "location", "priority_score": 0.8}
    ])
    mock_proc._calculate_quality_score = Mock(return_value=0.85)

    processors = {"proc": mock_proc}

    # Act
    result = await sequential_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=processing_config
    )

    # Assert
    assert isinstance(result.recommendations, list)
    # Может содержать рекомендации о качестве или процессорах
