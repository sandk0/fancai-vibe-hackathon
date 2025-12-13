"""
Тесты для ProcessorRegistry - управление NLP процессорами.

Тестируем:
- Инициализация registry
- Загрузка процессоров
- ProcessorConfig dataclass
- get_processor, get_enabled_processors
- Обработка ошибок инициализации
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch

from app.services.nlp.components.processor_registry import (
    ProcessorRegistry,
    ProcessorConfig
)


# ============================================================================
# TESTS: ProcessorConfig Dataclass
# ============================================================================

def test_processor_config_defaults():
    """Тест дефолтных значений ProcessorConfig."""
    # Act
    config = ProcessorConfig()

    # Assert
    assert config.enabled is True
    assert config.weight == 1.0
    assert config.confidence_threshold == 0.3
    assert config.min_description_length == 50
    assert config.max_description_length == 1000
    assert config.min_word_count == 10
    assert config.custom_settings == {}


def test_processor_config_custom_values():
    """Тест ProcessorConfig с кастомными значениями."""
    # Arrange & Act
    config = ProcessorConfig(
        enabled=False,
        weight=1.5,
        confidence_threshold=0.5,
        min_description_length=100,
        max_description_length=2000,
        min_word_count=20,
        custom_settings={"key": "value"}
    )

    # Assert
    assert config.enabled is False
    assert config.weight == 1.5
    assert config.confidence_threshold == 0.5
    assert config.min_description_length == 100
    assert config.max_description_length == 2000
    assert config.min_word_count == 20
    assert config.custom_settings == {"key": "value"}


def test_processor_config_custom_settings_init():
    """Тест что custom_settings инициализируется как пустой dict."""
    # Act
    config = ProcessorConfig()

    # Assert
    assert isinstance(config.custom_settings, dict)
    assert len(config.custom_settings) == 0


# ============================================================================
# TESTS: ProcessorRegistry Initialization
# ============================================================================

def test_processor_registry_init():
    """Тест создания ProcessorRegistry."""
    # Act
    registry = ProcessorRegistry()

    # Assert
    assert isinstance(registry.processors, dict)
    assert isinstance(registry.processor_configs, dict)
    assert registry._initialized is False
    assert len(registry.processors) == 0


@pytest.mark.asyncio
async def test_initialize_with_config_loader(mock_config_loader):
    """Тест инициализации с ConfigLoader."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    with patch.object(registry, '_initialize_processors', new_callable=AsyncMock):
        await registry.initialize(mock_config_loader)

    # Assert
    assert registry._initialized is True
    mock_config_loader.load_processor_configs.assert_called_once()


@pytest.mark.asyncio
async def test_initialize_only_once(mock_config_loader):
    """Тест что инициализация происходит только один раз."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    with patch.object(registry, '_initialize_processors', new_callable=AsyncMock) as mock_init:
        await registry.initialize(mock_config_loader)
        await registry.initialize(mock_config_loader)  # Second call

    # Assert
    assert registry._initialized is True
    # _initialize_processors должен быть вызван только раз
    assert mock_init.call_count == 1


@pytest.mark.asyncio
async def test_initialize_loads_processor_configs(mock_config_loader):
    """Тест загрузки processor configs."""
    # Arrange
    registry = ProcessorRegistry()
    test_configs = {
        "spacy": ProcessorConfig(enabled=True, weight=1.0),
        "natasha": ProcessorConfig(enabled=True, weight=1.2)
    }
    mock_config_loader.load_processor_configs = AsyncMock(return_value=test_configs)

    # Act
    with patch.object(registry, '_initialize_processors', new_callable=AsyncMock):
        await registry.initialize(mock_config_loader)

    # Assert
    assert registry.processor_configs == test_configs
    assert "spacy" in registry.processor_configs
    assert "natasha" in registry.processor_configs


# ============================================================================
# TESTS: Processor Loading
# ============================================================================

@pytest.mark.asyncio
async def test_initialize_processors_loads_enabled_only():
    """Тест что загружаются только enabled процессоры."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs = {
        "spacy": ProcessorConfig(enabled=True),
        "natasha": ProcessorConfig(enabled=False),  # Disabled
        "stanza": ProcessorConfig(enabled=True)
    }

    # Act
    with patch('app.services.enhanced_nlp_system.EnhancedSpacyProcessor') as MockSpacy, \
         patch('app.services.natasha_processor.EnhancedNatashaProcessor') as MockNatasha, \
         patch('app.services.stanza_processor.EnhancedStanzaProcessor') as MockStanza:

        mock_spacy = Mock()
        mock_spacy.load_model = AsyncMock()
        mock_spacy.is_available = Mock(return_value=True)
        MockSpacy.return_value = mock_spacy

        mock_stanza = Mock()
        mock_stanza.load_model = AsyncMock()
        mock_stanza.is_available = Mock(return_value=True)
        MockStanza.return_value = mock_stanza

        await registry._initialize_processors()

    # Assert
    assert "spacy" in registry.processors
    assert "natasha" not in registry.processors  # Disabled
    assert "stanza" in registry.processors


@pytest.mark.asyncio
async def test_initialize_processors_handles_unavailable():
    """Тест обработки недоступных процессоров."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs = {
        "spacy": ProcessorConfig(enabled=True),
        "natasha": ProcessorConfig(enabled=True),
        "stanza": ProcessorConfig(enabled=True)  # Need 2+ for ensemble, provide 3
    }

    # Act
    with patch('app.services.enhanced_nlp_system.EnhancedSpacyProcessor') as MockSpacy, \
         patch('app.services.natasha_processor.EnhancedNatashaProcessor') as MockNatasha, \
         patch('app.services.stanza_processor.EnhancedStanzaProcessor') as MockStanza:
        mock_spacy = Mock()
        mock_spacy.load_model = AsyncMock()
        mock_spacy.is_available = Mock(return_value=False)  # Not available
        MockSpacy.return_value = mock_spacy

        mock_natasha = Mock()
        mock_natasha.load_model = AsyncMock()
        mock_natasha.is_available = Mock(return_value=True)
        MockNatasha.return_value = mock_natasha

        mock_stanza = Mock()
        mock_stanza.load_model = AsyncMock()
        mock_stanza.is_available = Mock(return_value=True)
        MockStanza.return_value = mock_stanza

        await registry._initialize_processors()

    # Assert
    assert "spacy" not in registry.processors  # Should not be added (unavailable)
    assert "natasha" in registry.processors  # Should be added
    assert "stanza" in registry.processors  # Should be added


@pytest.mark.asyncio
async def test_initialize_processors_handles_exception():
    """Тест обработки исключений при загрузке процессора."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs = {
        "spacy": ProcessorConfig(enabled=True),
        "natasha": ProcessorConfig(enabled=True),
        "stanza": ProcessorConfig(enabled=True)  # Need 2+ for ensemble, provide 3
    }

    # Act
    with patch('app.services.enhanced_nlp_system.EnhancedSpacyProcessor') as MockSpacy, \
         patch('app.services.natasha_processor.EnhancedNatashaProcessor') as MockNatasha, \
         patch('app.services.stanza_processor.EnhancedStanzaProcessor') as MockStanza:
        MockSpacy.side_effect = Exception("Failed to initialize")

        mock_natasha = Mock()
        mock_natasha.load_model = AsyncMock()
        mock_natasha.is_available = Mock(return_value=True)
        MockNatasha.return_value = mock_natasha

        mock_stanza = Mock()
        mock_stanza.load_model = AsyncMock()
        mock_stanza.is_available = Mock(return_value=True)
        MockStanza.return_value = mock_stanza

        await registry._initialize_processors()

    # Assert
    assert "spacy" not in registry.processors  # Should not be added due to exception
    assert "natasha" in registry.processors  # Should be added
    assert "stanza" in registry.processors  # Should be added


# ============================================================================
# TESTS: Get Processor Methods
# ============================================================================

def test_get_processor_existing():
    """Тест получения существующего процессора."""
    # Arrange
    registry = ProcessorRegistry()
    mock_processor = Mock()
    registry.processors["spacy"] = mock_processor

    # Act
    processor = registry.get_processor("spacy")

    # Assert
    assert processor == mock_processor


def test_get_processor_nonexistent():
    """Тест получения несуществующего процессора."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    processor = registry.get_processor("nonexistent")

    # Assert
    assert processor is None


def test_get_all_processors():
    """Тест получения списка всех процессоров."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processors = {
        "spacy": Mock(),
        "natasha": Mock(),
        "stanza": Mock()
    }

    # Act
    all_processors = registry.get_all_processors()

    # Assert
    assert len(all_processors) == 3
    assert "spacy" in all_processors
    assert "natasha" in all_processors
    assert "stanza" in all_processors


def test_get_all_processors_empty():
    """Тест get_all_processors когда нет процессоров."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    all_processors = registry.get_all_processors()

    # Assert
    assert all_processors == {}


# ============================================================================
# TESTS: Get Processor Status
# ============================================================================

def test_get_status():
    """Тест получения статуса всех процессоров."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs = {
        "spacy": ProcessorConfig(enabled=True)
    }
    mock_processor = Mock()
    mock_processor.processor_type.value = "spacy"
    mock_processor.loaded = True
    mock_processor.is_available = Mock(return_value=True)
    mock_processor.get_performance_metrics = Mock(return_value={"f1_score": 0.85})
    registry.processors = {"spacy": mock_processor}

    # Act
    status = registry.get_status()

    # Assert
    assert "available_processors" in status
    assert "processor_details" in status
    assert "spacy" in status["available_processors"]
    assert "spacy" in status["processor_details"]
    assert status["processor_details"]["spacy"]["loaded"] is True
    assert status["processor_details"]["spacy"]["available"] is True


def test_get_status_empty():
    """Тест get_status без процессоров."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    status = registry.get_status()

    # Assert
    assert "available_processors" in status
    assert "processor_details" in status
    assert status["available_processors"] == []
    assert status["processor_details"] == {}


# ============================================================================
# TESTS: Update Processor Config
# ============================================================================

@pytest.mark.asyncio
async def test_update_processor_config():
    """Тест обновления конфигурации процессора."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs["spacy"] = ProcessorConfig(weight=1.0)

    # Mock processor
    mock_processor = Mock()
    mock_processor.load_model = AsyncMock()
    registry.processors["spacy"] = mock_processor

    # Mock settings manager
    mock_settings = AsyncMock()
    mock_settings.set_category_settings = AsyncMock()

    # Act
    new_config = {"weight": 1.5, "confidence_threshold": 0.5}
    result = await registry.update_processor_config("spacy", new_config, mock_settings)

    # Assert
    assert result is True
    assert registry.processor_configs["spacy"].weight == 1.5
    assert registry.processor_configs["spacy"].confidence_threshold == 0.5
    mock_settings.set_category_settings.assert_called_once()
    mock_processor.load_model.assert_called_once()


@pytest.mark.asyncio
async def test_update_processor_config_nonexistent():
    """Тест обновления несуществующего процессора."""
    # Arrange
    registry = ProcessorRegistry()

    # Mock settings manager
    mock_settings = AsyncMock()
    mock_settings.set_category_settings = AsyncMock()

    # Act
    new_config = {"weight": 1.5}
    result = await registry.update_processor_config("nonexistent", new_config, mock_settings)

    # Assert - should return False since processor doesn't exist
    assert result is False


# ============================================================================
# TESTS: is_initialized
# ============================================================================

def test_is_initialized_false_by_default():
    """Тест что registry не инициализирован по умолчанию."""
    # Arrange & Act
    registry = ProcessorRegistry()

    # Assert
    assert registry.is_initialized() is False


@pytest.mark.asyncio
async def test_is_initialized_true_after_initialize(mock_config_loader):
    """Тест что registry инициализирован после initialize."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    with patch.object(registry, '_initialize_processors', new_callable=AsyncMock):
        await registry.initialize(mock_config_loader)

    # Assert
    assert registry.is_initialized() is True


# ============================================================================
# TESTS: get_processor_config
# ============================================================================

def test_get_processor_config_existing():
    """Тест получения существующей конфигурации."""
    # Arrange
    registry = ProcessorRegistry()
    config = ProcessorConfig(weight=1.5)
    registry.processor_configs["spacy"] = config

    # Act
    result = registry.get_processor_config("spacy")

    # Assert
    assert result == config
    assert result.weight == 1.5


def test_get_processor_config_nonexistent():
    """Тест получения несуществующей конфигурации."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    result = registry.get_processor_config("nonexistent")

    # Assert
    assert result is None
