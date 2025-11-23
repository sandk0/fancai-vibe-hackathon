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
    with patch('app.services.nlp.components.processor_registry.EnhancedSpacyProcessor') as MockSpacy, \
         patch('app.services.nlp.components.processor_registry.EnhancedNatashaProcessor') as MockNatasha, \
         patch('app.services.nlp.components.processor_registry.EnhancedStanzaProcessor') as MockStanza:

        mock_spacy = AsyncMock()
        mock_spacy.load_model = AsyncMock()
        mock_spacy.is_available = Mock(return_value=True)
        MockSpacy.return_value = mock_spacy

        mock_stanza = AsyncMock()
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
        "spacy": ProcessorConfig(enabled=True)
    }

    # Act
    with patch('app.services.nlp.components.processor_registry.EnhancedSpacyProcessor') as MockSpacy:
        mock_spacy = AsyncMock()
        mock_spacy.load_model = AsyncMock()
        mock_spacy.is_available = Mock(return_value=False)  # Not available
        MockSpacy.return_value = mock_spacy

        await registry._initialize_processors()

    # Assert
    assert "spacy" not in registry.processors  # Should not be added


@pytest.mark.asyncio
async def test_initialize_processors_handles_exception():
    """Тест обработки исключений при загрузке процессора."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs = {
        "spacy": ProcessorConfig(enabled=True)
    }

    # Act
    with patch('app.services.nlp.components.processor_registry.EnhancedSpacyProcessor') as MockSpacy:
        MockSpacy.side_effect = Exception("Failed to initialize")

        await registry._initialize_processors()

    # Assert
    assert "spacy" not in registry.processors  # Should not be added due to exception


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


def test_get_enabled_processors():
    """Тест получения списка enabled процессоров."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processors = {
        "spacy": Mock(),
        "natasha": Mock(),
        "stanza": Mock()
    }

    # Act
    enabled = registry.get_enabled_processors()

    # Assert
    assert len(enabled) == 3
    assert "spacy" in enabled
    assert "natasha" in enabled
    assert "stanza" in enabled


def test_get_enabled_processors_empty():
    """Тест get_enabled_processors когда нет процессоров."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    enabled = registry.get_enabled_processors()

    # Assert
    assert enabled == []


# ============================================================================
# TESTS: Get Processor Status
# ============================================================================

def test_get_processor_status():
    """Тест получения статуса всех процессоров."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs = {
        "spacy": ProcessorConfig(enabled=True),
        "natasha": ProcessorConfig(enabled=False)
    }
    registry.processors = {"spacy": Mock()}

    # Act
    status = registry.get_processor_status()

    # Assert
    assert "spacy" in status
    assert status["spacy"]["loaded"] is True
    assert status["spacy"]["enabled"] is True
    assert "natasha" in status
    assert status["natasha"]["loaded"] is False
    assert status["natasha"]["enabled"] is False


def test_get_processor_status_empty():
    """Тест get_processor_status без процессоров."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    status = registry.get_processor_status()

    # Assert
    assert status == {}


# ============================================================================
# TESTS: Update Processor Config
# ============================================================================

def test_update_processor_config():
    """Тест обновления конфигурации процессора."""
    # Arrange
    registry = ProcessorRegistry()
    registry.processor_configs["spacy"] = ProcessorConfig(weight=1.0)

    # Act
    new_config = ProcessorConfig(weight=1.5, confidence_threshold=0.5)
    registry.update_processor_config("spacy", new_config)

    # Assert
    assert registry.processor_configs["spacy"].weight == 1.5
    assert registry.processor_configs["spacy"].confidence_threshold == 0.5


def test_update_processor_config_nonexistent():
    """Тест обновления несуществующего процессора."""
    # Arrange
    registry = ProcessorRegistry()

    # Act
    new_config = ProcessorConfig(weight=1.5)
    registry.update_processor_config("nonexistent", new_config)

    # Assert
    assert "nonexistent" in registry.processor_configs
    assert registry.processor_configs["nonexistent"].weight == 1.5


# ============================================================================
# TESTS: Health Check
# ============================================================================

@pytest.mark.asyncio
async def test_health_check_all_healthy():
    """Тест health check когда все процессоры healthy."""
    # Arrange
    registry = ProcessorRegistry()
    mock_proc1 = AsyncMock()
    mock_proc1.health_check = AsyncMock(return_value=True)
    mock_proc2 = AsyncMock()
    mock_proc2.health_check = AsyncMock(return_value=True)

    registry.processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    health = await registry.health_check()

    # Assert
    assert health["healthy"] is True
    assert health["proc1"] is True
    assert health["proc2"] is True


@pytest.mark.asyncio
async def test_health_check_some_unhealthy():
    """Тест health check когда некоторые процессоры unhealthy."""
    # Arrange
    registry = ProcessorRegistry()
    mock_proc1 = AsyncMock()
    mock_proc1.health_check = AsyncMock(return_value=True)
    mock_proc2 = AsyncMock()
    mock_proc2.health_check = AsyncMock(return_value=False)

    registry.processors = {"proc1": mock_proc1, "proc2": mock_proc2}

    # Act
    health = await registry.health_check()

    # Assert
    assert health["healthy"] is False
    assert health["proc1"] is True
    assert health["proc2"] is False
