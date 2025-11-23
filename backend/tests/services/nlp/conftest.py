"""
Shared fixtures для NLP тестов.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, Mock
from typing import List, Dict, Any


# ============================================================================
# SAMPLE TEXT FIXTURES
# ============================================================================

@pytest.fixture
def sample_text():
    """Базовый пример текста на русском языке."""
    return """
    В глубоком темном лесу стояла старая избушка на курьих ножках.
    Вокруг нее росли высокие сосны и ели, их ветви касались крыши.
    Иван Петрович медленно приближался к избушке, внимательно осматривая окрестности.
    Тишина была такая, что слышно было, как падают с деревьев шишки.
    Красивое закатное небо окрашивало лес в золотисто-красные тона.
    """


@pytest.fixture
def complex_text():
    """Сложный текст для ADAPTIVE режима."""
    return """
    Князь Андрей Болконский и Пьер Безухов встретились в Москве на балу у графа Ростова.
    Великолепный зал был украшен хрустальными люстрами и позолоченными зеркалами.
    Петербургское высшее общество собралось в особняке на Тверской улице.
    Анна Павловна Шерер устраивала вечер, где присутствовали все знатные особы столицы.
    Граф Илья Андреевич Ростов радушно встречал гостей в своей просторной гостиной.
    """


@pytest.fixture
def empty_text():
    """Пустой текст для тестирования edge cases."""
    return ""


@pytest.fixture
def short_text():
    """Короткий текст (<100 символов)."""
    return "Это короткий текст."


@pytest.fixture
def long_text():
    """Длинный текст для тестирования производительности."""
    return """
    Война и мир - роман-эпопея Льва Николаевича Толстого,
    описывающий события Отечественной войны 1812 года.
    В романе показана жизнь русского общества в период с 1805 по 1820 год.
    """ * 100  # Повторяем 100 раз для получения ~8000 символов


# ============================================================================
# MOCK PROCESSOR FIXTURES
# ============================================================================

@pytest.fixture
def mock_processor_results():
    """Mock результаты от одного процессора."""
    return [
        {
            "content": "глубокий темный лес",
            "type": "location",
            "priority_score": 0.85,
            "chapter_position": 0,
            "context": "В глубоком темном лесу стояла старая избушка",
            "entities": ["лес"],
            "adjectives": ["глубокий", "темный"],
            "source": "spacy"
        },
        {
            "content": "старая избушка на курьих ножках",
            "type": "location",
            "priority_score": 0.90,
            "chapter_position": 0,
            "context": "стояла старая избушка на курьих ножках",
            "entities": ["избушка"],
            "adjectives": ["старая"],
            "source": "spacy"
        },
        {
            "content": "Иван Петрович",
            "type": "character",
            "priority_score": 0.92,
            "chapter_position": 0,
            "context": "Иван Петрович медленно приближался к избушке",
            "entities": ["Иван Петрович"],
            "adjectives": [],
            "source": "spacy"
        }
    ]


@pytest.fixture
def mock_spacy_processor():
    """Mock SpaCy processor."""
    processor = Mock()
    processor.processor_type = "spacy"
    processor.loaded = True
    processor.model = Mock()
    processor.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "глубокий темный лес",
            "type": "location",
            "priority_score": 0.85,
            "chapter_position": 0,
            "context": "В глубоком темном лесу стояла старая избушка",
            "entities": ["лес"],
            "adjectives": ["глубокий", "темный"],
            "source": "spacy"
        }
    ])
    processor._calculate_quality_score = Mock(return_value=0.85)
    return processor


@pytest.fixture
def mock_natasha_processor():
    """Mock Natasha processor."""
    processor = Mock()
    processor.processor_type = "natasha"
    processor.loaded = True
    processor.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "Иван Петрович",
            "type": "character",
            "priority_score": 0.92,
            "chapter_position": 0,
            "context": "Иван Петрович медленно приближался к избушке",
            "entities": ["Иван Петрович"],
            "adjectives": [],
            "source": "natasha"
        }
    ])
    processor._calculate_quality_score = Mock(return_value=0.92)
    return processor


@pytest.fixture
def mock_stanza_processor():
    """Mock Stanza processor."""
    processor = Mock()
    processor.processor_type = "stanza"
    processor.loaded = True
    processor.extract_descriptions = AsyncMock(return_value=[
        {
            "content": "высокие сосны и ели",
            "type": "location",
            "priority_score": 0.78,
            "chapter_position": 50,
            "context": "Вокруг нее росли высокие сосны и ели",
            "entities": ["сосны", "ели"],
            "adjectives": ["высокие"],
            "source": "stanza"
        }
    ])
    processor._calculate_quality_score = Mock(return_value=0.78)
    return processor


@pytest.fixture
def mock_processors_dict(mock_spacy_processor, mock_natasha_processor, mock_stanza_processor):
    """Dictionary of mock processors."""
    return {
        "spacy": mock_spacy_processor,
        "natasha": mock_natasha_processor,
        "stanza": mock_stanza_processor
    }


# ============================================================================
# CONFIG FIXTURES
# ============================================================================

@pytest.fixture
def default_processor_config():
    """Default processor configuration."""
    return {
        "enabled": True,
        "weight": 1.0,
        "confidence_threshold": 0.3,
        "min_description_length": 50,
        "max_description_length": 1000,
        "min_word_count": 10,
        "custom_settings": {}
    }


@pytest.fixture
def ensemble_config():
    """Configuration for ensemble mode."""
    return {
        "consensus_threshold": 0.6,
        "min_processors": 2,
        "voting_weights": {
            "spacy": 1.0,
            "natasha": 1.2,
            "stanza": 0.8
        },
        "enable_context_enrichment": True,
        "enable_deduplication": True
    }


@pytest.fixture
def processing_config():
    """General processing configuration."""
    return {
        "max_workers": 3,
        "timeout": 30.0,
        "enable_caching": True,
        "cache_ttl": 3600
    }


# ============================================================================
# PROCESSOR REGISTRY FIXTURES
# ============================================================================

@pytest.fixture
def mock_processor_registry(mock_processors_dict):
    """Mock ProcessorRegistry."""
    registry = Mock()
    registry.processors = mock_processors_dict
    registry.processor_configs = {
        "spacy": Mock(enabled=True, weight=1.0, confidence_threshold=0.3),
        "natasha": Mock(enabled=True, weight=1.2, confidence_threshold=0.3),
        "stanza": Mock(enabled=True, weight=0.8, confidence_threshold=0.3)
    }
    registry._initialized = True
    registry.get_processor = Mock(side_effect=lambda name: mock_processors_dict.get(name))
    registry.get_enabled_processors = Mock(return_value=list(mock_processors_dict.keys()))
    registry.get_processor_status = Mock(return_value={
        "spacy": {"loaded": True, "enabled": True},
        "natasha": {"loaded": True, "enabled": True},
        "stanza": {"loaded": True, "enabled": True}
    })
    return registry


@pytest.fixture
def mock_config_loader():
    """Mock ConfigLoader."""
    loader = Mock()
    loader.load_processor_configs = AsyncMock(return_value={
        "spacy": Mock(enabled=True, weight=1.0, confidence_threshold=0.3),
        "natasha": Mock(enabled=True, weight=1.2, confidence_threshold=0.3),
        "stanza": Mock(enabled=True, weight=0.8, confidence_threshold=0.3)
    })
    loader.get_ensemble_config = Mock(return_value={
        "consensus_threshold": 0.6,
        "min_processors": 2,
        "voting_weights": {"spacy": 1.0, "natasha": 1.2, "stanza": 0.8}
    })
    return loader


@pytest.fixture
def mock_ensemble_voter():
    """Mock EnsembleVoter."""
    voter = Mock()
    # vote() is a synchronous method that returns list of descriptions
    voter.vote = Mock(return_value=[
        {
            "content": "глубокий темный лес",
            "type": "location",
            "priority_score": 0.88,
            "consensus_score": 0.75,
            "sources": ["spacy", "natasha"],
            "context": "В глубоком темном лесу стояла старая избушка"
        }
    ])
    return voter


# ============================================================================
# CHAPTER ID FIXTURE
# ============================================================================

@pytest.fixture
def sample_chapter_id():
    """Sample chapter ID for testing."""
    return "550e8400-e29b-41d4-a716-446655440000"
