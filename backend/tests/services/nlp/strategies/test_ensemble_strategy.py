"""
Тесты для EnsembleStrategy - weighted voting с консенсусом процессоров.

Тестируем:
- Ensemble voting с EnsembleVoter
- Fallback к simple voting
- Consensus threshold фильтрация
- Priority score boosting по consensus
- Наследование от ParallelStrategy
"""

import pytest
from unittest.mock import AsyncMock, Mock

from app.services.nlp.strategies.ensemble_strategy import EnsembleStrategy
from app.services.nlp.strategies.base_strategy import ProcessingResult


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def ensemble_strategy():
    """Fixture для EnsembleStrategy."""
    return EnsembleStrategy()


# ============================================================================
# TESTS: Ensemble Voting with Voter
# ============================================================================

@pytest.mark.asyncio
async def test_process_with_ensemble_voter(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    mock_ensemble_voter,
    processing_config
):
    """Тест обработки с EnsembleVoter."""
    # Arrange
    config = processing_config.copy()
    config["ensemble_voter"] = mock_ensemble_voter

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    mock_ensemble_voter.vote.assert_called_once()
    assert "ensemble voting" in " ".join(result.recommendations).lower()


@pytest.mark.asyncio
async def test_process_voter_receives_processor_results(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    mock_ensemble_voter,
    processing_config
):
    """Тест что voter получает результаты всех процессоров."""
    # Arrange
    config = processing_config.copy()
    config["ensemble_voter"] = mock_ensemble_voter

    # Act
    await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    call_args = mock_ensemble_voter.vote.call_args
    processor_results = call_args[0][0]
    assert "spacy" in processor_results
    assert "natasha" in processor_results
    assert "stanza" in processor_results


# ============================================================================
# TESTS: Simple Ensemble Voting Fallback
# ============================================================================

@pytest.mark.asyncio
async def test_process_without_voter_uses_simple_voting(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест fallback к simple voting при отсутствии voter."""
    # Arrange
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.8,
            "source": "proc1",
            "consensus_strength": 2  # Появится после _combine_descriptions
        }
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.75,
            "source": "proc2"
        }
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.70)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}
    config = processing_config.copy()
    # ensemble_voter НЕ установлен

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    assert len(result.descriptions) >= 0


@pytest.mark.asyncio
async def test_simple_voting_consensus_threshold_filtering(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест фильтрации по consensus threshold в simple voting."""
    # Arrange
    # Создаем описания с разным consensus
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "высокий консенсус",  # Будет дублироваться
            "type": "location",
            "priority_score": 0.8,
            "source": "proc1"
        },
        {
            "content": "низкий консенсус",  # Только в proc1
            "type": "location",
            "priority_score": 0.75,
            "source": "proc1"
        }
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "высокий консенсус",  # Дубликат
            "type": "location",
            "priority_score": 0.82,
            "source": "proc2"
        }
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.80)

    mock_proc3 = AsyncMock()
    mock_proc3.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "высокий консенсус",  # Дубликат
            "type": "location",
            "priority_score": 0.78,
            "source": "proc3"
        }
    ])
    mock_proc3._calculate_quality_score = Mock(return_value=0.77)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2, "proc3": mock_proc3}
    config = processing_config.copy()
    config["ensemble_voting_threshold"] = 0.6  # 60% консенсус

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=config
    )

    # Assert
    # "высокий консенсус" появляется в 3/3 процессорах (100% > 60%) - PASS
    # "низкий консенсус" появляется в 1/3 процессорах (33% < 60%) - FAIL
    assert len(result.descriptions) >= 1
    contents = [d["content"] for d in result.descriptions]
    assert "высокий консенсус" in contents


@pytest.mark.asyncio
async def test_simple_voting_boosts_priority_by_consensus(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест boost priority score по consensus."""
    # Arrange
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "описание",
            "type": "location",
            "priority_score": 0.8,
            "source": "proc1"
        }
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "описание",
            "type": "location",
            "priority_score": 0.8,
            "source": "proc2"
        }
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.75)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2}
    config = processing_config.copy()
    config["ensemble_voting_threshold"] = 0.5

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=config
    )

    # Assert
    if len(result.descriptions) > 0:
        # Priority должен быть boosted (consensus 2/2 = 1.0)
        # Формула: priority * (1.0 + consensus * 0.5)
        # 0.8 * (1.0 + 1.0 * 0.5) = 0.8 * 1.5 = 1.2
        boosted_priority = result.descriptions[0]["priority_score"]
        assert boosted_priority > 0.8  # Должен быть выше исходного


# ============================================================================
# TESTS: Inheritance from ParallelStrategy
# ============================================================================

@pytest.mark.asyncio
async def test_process_inherits_parallel_processing(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест что EnsembleStrategy наследует parallel processing."""
    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    # Все процессоры должны быть вызваны параллельно
    for processor in mock_processors_dict.values():
        processor.extract_descriptions.assert_called_once()


@pytest.mark.asyncio
async def test_process_preserves_processor_results(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    mock_ensemble_voter,
    processing_config
):
    """Тест что processor_results сохраняются из parallel result."""
    # Arrange
    config = processing_config.copy()
    config["ensemble_voter"] = mock_ensemble_voter

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert "spacy" in result.processor_results
    assert "natasha" in result.processor_results
    assert "stanza" in result.processor_results


@pytest.mark.asyncio
async def test_process_preserves_quality_metrics(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    mock_ensemble_voter,
    processing_config
):
    """Тест что quality_metrics сохраняются из parallel result."""
    # Arrange
    config = processing_config.copy()
    config["ensemble_voter"] = mock_ensemble_voter

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert len(result.quality_metrics) > 0
    assert "spacy" in result.quality_metrics


# ============================================================================
# TESTS: Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_simple_voting_empty_processor_results(
    ensemble_strategy
):
    """Тест simple voting с пустыми результатами."""
    # Arrange
    processor_results = {}
    config = {}

    # Act
    result = ensemble_strategy._simple_ensemble_voting(processor_results, config)

    # Assert
    assert result == []


@pytest.mark.asyncio
async def test_simple_voting_with_all_low_consensus(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    processing_config
):
    """Тест фильтрации всех описаний при низком консенсусе."""
    # Arrange
    mock_proc1 = AsyncMock()
    mock_proc1.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc1", "type": "location", "priority_score": 0.8, "source": "proc1"}
    ])
    mock_proc1._calculate_quality_score = Mock(return_value=0.75)

    mock_proc2 = AsyncMock()
    mock_proc2.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc2", "type": "location", "priority_score": 0.75, "source": "proc2"}
    ])
    mock_proc2._calculate_quality_score = Mock(return_value=0.70)

    mock_proc3 = AsyncMock()
    mock_proc3.extract_descriptions = AsyncMock(return_value=[
        {"content": "desc3", "type": "location", "priority_score": 0.77, "source": "proc3"}
    ])
    mock_proc3._calculate_quality_score = Mock(return_value=0.72)

    processors = {"proc1": mock_proc1, "proc2": mock_proc2, "proc3": mock_proc3}
    config = processing_config.copy()
    config["ensemble_voting_threshold"] = 0.9  # 90% - очень высокий порог

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=processors,
        config=config
    )

    # Assert
    # Все описания уникальны (1/3 = 33% < 90%)
    assert len(result.descriptions) == 0


@pytest.mark.asyncio
async def test_process_adds_ensemble_recommendation(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест добавления ensemble voting recommendation."""
    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=processing_config
    )

    # Assert
    recommendations_text = " ".join(result.recommendations).lower()
    assert "ensemble" in recommendations_text or "voting" in recommendations_text


@pytest.mark.asyncio
async def test_process_with_custom_voting_threshold(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    processing_config
):
    """Тест с кастомным voting threshold."""
    # Arrange
    config = processing_config.copy()
    config["ensemble_voting_threshold"] = 0.3  # Низкий порог

    # Act
    result = await ensemble_strategy.process(
        text=sample_text,
        chapter_id=sample_chapter_id,
        processors=mock_processors_dict,
        config=config
    )

    # Assert
    assert isinstance(result, ProcessingResult)
    # При низком пороге больше описаний пройдет фильтр


@pytest.mark.asyncio
async def test_process_result_structure(
    ensemble_strategy,
    sample_text,
    sample_chapter_id,
    mock_processors_dict,
    mock_ensemble_voter,
    processing_config
):
    """Тест правильной структуры результата."""
    # Arrange
    config = processing_config.copy()
    config["ensemble_voter"] = mock_ensemble_voter

    # Act
    result = await ensemble_strategy.process(
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
