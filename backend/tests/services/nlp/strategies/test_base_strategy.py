"""
Тесты для BaseStrategy - abstract base class для всех стратегий.

Тестируем:
- ProcessingResult dataclass
- _combine_descriptions метод
- Abstract method enforcement
"""

import pytest
from typing import List, Dict, Any

from app.services.nlp.strategies.base_strategy import (
    ProcessingStrategy,
    ProcessingResult
)


# ============================================================================
# TESTS: ProcessingResult Dataclass
# ============================================================================

def test_processing_result_initialization():
    """Тест создания ProcessingResult с базовыми данными."""
    # Arrange & Act
    result = ProcessingResult(
        descriptions=[{"content": "test"}],
        processor_results={"spacy": [{"content": "test"}]},
        processing_time=1.5,
        processors_used=["spacy"],
        quality_metrics={"spacy": 0.8},
        recommendations=["Use ensemble mode"]
    )

    # Assert
    assert len(result.descriptions) == 1
    assert result.processing_time == 1.5
    assert "spacy" in result.processors_used
    assert result.quality_metrics["spacy"] == 0.8


def test_processing_result_empty():
    """Тест ProcessingResult с пустыми данными."""
    # Arrange & Act
    result = ProcessingResult(
        descriptions=[],
        processor_results={},
        processing_time=0.0,
        processors_used=[],
        quality_metrics={},
        recommendations=[]
    )

    # Assert
    assert len(result.descriptions) == 0
    assert result.processing_time == 0.0
    assert len(result.processors_used) == 0


# ============================================================================
# TESTS: Abstract Base Class
# ============================================================================

def test_processing_strategy_is_abstract():
    """Тест что ProcessingStrategy - abstract class."""
    # Act & Assert
    with pytest.raises(TypeError, match="Can't instantiate abstract class"):
        ProcessingStrategy()


def test_processing_strategy_requires_process_method():
    """Тест что наследники должны реализовать process()."""
    # Arrange
    class IncompleteStrategy(ProcessingStrategy):
        """Strategy без реализации process()."""
        pass

    # Act & Assert
    with pytest.raises(TypeError, match="Can't instantiate abstract class"):
        IncompleteStrategy()


# ============================================================================
# TESTS: _combine_descriptions Method
# ============================================================================

class ConcreteStrategy(ProcessingStrategy):
    """Concrete implementation для тестирования base methods."""

    async def process(self, text, chapter_id, processors, config):
        """Dummy implementation."""
        return ProcessingResult(
            descriptions=[],
            processor_results={},
            processing_time=0.0,
            processors_used=[],
            quality_metrics={},
            recommendations=[]
        )


@pytest.fixture
def strategy():
    """Fixture для concrete strategy."""
    return ConcreteStrategy()


def test_combine_descriptions_empty_list(strategy):
    """Тест обработки пустого списка описаний."""
    # Arrange
    descriptions = []

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert result == []


def test_combine_descriptions_single_description(strategy):
    """Тест с одним описанием."""
    # Arrange
    descriptions = [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85,
            "source": "spacy"
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert len(result) == 1
    assert result[0]["content"] == "темный лес"
    assert "sources" in result[0]
    assert "consensus_strength" in result[0]


def test_combine_descriptions_deduplication(strategy):
    """Тест дедупликации идентичных описаний."""
    # Arrange
    descriptions = [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85,
            "source": "spacy"
        },
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.80,  # Lower score
            "source": "natasha"
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert len(result) == 1  # Deduplicated to 1
    assert result[0]["priority_score"] == 0.85  # Higher score selected
    assert "spacy" in result[0]["sources"]
    assert "natasha" in result[0]["sources"]
    assert result[0]["consensus_strength"] == 2


def test_combine_descriptions_different_types(strategy):
    """Тест группировки по типу описания."""
    # Arrange
    descriptions = [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85,
            "source": "spacy"
        },
        {
            "content": "Иван Петрович",
            "type": "character",
            "priority_score": 0.90,
            "source": "natasha"
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert len(result) == 2  # Different types, not combined


def test_combine_descriptions_selects_highest_score(strategy):
    """Тест выбора описания с наивысшим score при дедупликации."""
    # Arrange
    descriptions = [
        {
            "content": "очень длинное описание темного леса с множеством деталей",
            "type": "location",
            "priority_score": 0.75,
            "source": "spacy"
        },
        {
            "content": "очень длинное описание темного леса с множеством деталей",
            "type": "location",
            "priority_score": 0.92,  # Highest
            "source": "natasha"
        },
        {
            "content": "очень длинное описание темного леса с множеством деталей",
            "type": "location",
            "priority_score": 0.80,
            "source": "stanza"
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert len(result) == 1
    assert result[0]["priority_score"] == 0.92
    assert result[0]["source"] == "natasha"
    assert result[0]["consensus_strength"] == 3
    assert len(result[0]["sources"]) == 3


def test_combine_descriptions_truncates_long_content_for_key(strategy):
    """Тест что длинный content truncate при создании ключа (100 символов)."""
    # Arrange
    long_content = "А" * 150  # 150 символов
    descriptions = [
        {
            "content": long_content,
            "type": "location",
            "priority_score": 0.85,
            "source": "spacy"
        },
        {
            "content": long_content,
            "type": "location",
            "priority_score": 0.90,
            "source": "natasha"
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert len(result) == 1  # Should be deduplicated despite truncation
    assert result[0]["consensus_strength"] == 2


def test_combine_descriptions_preserves_all_fields(strategy):
    """Тест что все поля описания сохраняются."""
    # Arrange
    descriptions = [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85,
            "source": "spacy",
            "chapter_position": 100,
            "context": "В темном лесу...",
            "entities": ["лес"],
            "adjectives": ["темный"],
            "custom_field": "custom_value"
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert result[0]["content"] == "темный лес"
    assert result[0]["type"] == "location"
    assert result[0]["chapter_position"] == 100
    assert result[0]["context"] == "В темном лесу..."
    assert result[0]["custom_field"] == "custom_value"


def test_combine_descriptions_missing_priority_score(strategy):
    """Тест обработки описаний без priority_score."""
    # Arrange
    descriptions = [
        {
            "content": "темный лес",
            "type": "location",
            # priority_score отсутствует
            "source": "spacy"
        },
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.80,
            "source": "natasha"
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert len(result) == 1
    # Описание с priority_score должно быть выбрано
    assert result[0]["priority_score"] == 0.80


def test_combine_descriptions_missing_source(strategy):
    """Тест обработки описаний без source поля."""
    # Arrange
    descriptions = [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85
            # source отсутствует
        }
    ]

    # Act
    result = strategy._combine_descriptions(descriptions)

    # Assert
    assert len(result) == 1
    assert "unknown" in result[0]["sources"]
