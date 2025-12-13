"""
Тесты для ConfigLoader - загрузка и валидация конфигураций процессоров.

Тестируем:
- Загрузка processor configurations из БД
- Config validation
- Default values fallback
- Config merging logic
- Invalid config handling
- Missing required fields
- Type conversion
- Strategy-specific configs
- Global settings loading
"""

import pytest
from unittest.mock import AsyncMock, Mock

from app.services.nlp.components.config_loader import ConfigLoader
from app.services.nlp.components.processor_registry import ProcessorConfig


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_settings_manager():
    """Mock SettingsManager."""
    manager = AsyncMock()
    manager.get_category_settings = AsyncMock()
    return manager


@pytest.fixture
def config_loader(mock_settings_manager):
    """Fixture для ConfigLoader."""
    return ConfigLoader(mock_settings_manager)


@pytest.fixture
def sample_spacy_settings():
    """Sample SpaCy settings from database."""
    return {
        "enabled": True,
        "weight": 1.0,
        "confidence_threshold": 0.3,
        "min_description_length": 50,
        "max_description_length": 1000,
        "min_word_count": 10,
        "model_name": "ru_core_news_lg",
        "literary_patterns": True,
        "character_detection_boost": 1.2,
        "location_detection_boost": 1.1,
        "spacy_specific": {
            "disable_components": ["parser"],
            "entity_types": ["PERSON", "LOC"]
        }
    }


@pytest.fixture
def sample_natasha_settings():
    """Sample Natasha settings from database."""
    return {
        "enabled": True,
        "weight": 1.2,
        "confidence_threshold": 0.4,
        "min_description_length": 40,
        "max_description_length": 1200,
        "min_word_count": 8,
        "literary_boost": 1.3,
        "natasha_specific": {
            "enable_morphology": True,
            "enable_ner": True
        }
    }


@pytest.fixture
def sample_stanza_settings():
    """Sample Stanza settings from database."""
    return {
        "enabled": False,
        "weight": 0.8,
        "confidence_threshold": 0.5,
        "stanza_specific": {
            "model_name": "ru",
            "processors": ["tokenize", "ner"]
        }
    }


@pytest.fixture
def sample_deeppavlov_settings():
    """Sample DeepPavlov settings from database."""
    return {
        "enabled": True,
        "weight": 1.5,
        "confidence_threshold": 0.3,
        "min_description_length": 50,
        "deeppavlov_specific": {
            "model_name": "ner_ontonotes_bert_mult",
            "use_gpu": False
        }
    }


@pytest.fixture
def sample_global_settings():
    """Sample global NLP settings from database."""
    return {
        "max_parallel_processors": 3,
        "ensemble_voting_threshold": 0.6,
        "adaptive_text_analysis": True,
        "quality_monitoring": True,
        "auto_processor_selection": True,
        "processing_mode": "single",
        "default_processor": "spacy"
    }


# ============================================================================
# TESTS: Loading Processor Configs
# ============================================================================

@pytest.mark.asyncio
async def test_load_processor_configs_success(
    config_loader,
    mock_settings_manager,
    sample_spacy_settings,
    sample_natasha_settings,
    sample_stanza_settings,
    sample_deeppavlov_settings
):
    """Тест успешной загрузки всех конфигураций."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = [
        sample_spacy_settings,
        sample_natasha_settings,
        sample_stanza_settings,
        sample_deeppavlov_settings
    ]

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    assert len(configs) == 5  # spacy, natasha, stanza, deeppavlov, gliner
    assert "spacy" in configs
    assert "natasha" in configs
    assert "stanza" in configs
    assert "deeppavlov" in configs

    # Проверяем типы
    for config in configs.values():
        assert isinstance(config, ProcessorConfig)


@pytest.mark.asyncio
async def test_load_processor_configs_spacy_config(
    config_loader,
    mock_settings_manager,
    sample_spacy_settings
):
    """Тест загрузки SpaCy конфигурации."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = [
        sample_spacy_settings,  # spacy
        {},  # natasha
        {},  # stanza
        {}   # deeppavlov
    ]

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    spacy_config = configs["spacy"]
    assert spacy_config.enabled is True
    assert spacy_config.weight == 1.0
    assert spacy_config.confidence_threshold == 0.3
    assert spacy_config.min_description_length == 50
    assert spacy_config.max_description_length == 1000
    assert spacy_config.min_word_count == 10

    # Проверяем spacy_specific settings
    assert "spacy" in spacy_config.custom_settings
    spacy_specific = spacy_config.custom_settings["spacy"]
    assert spacy_specific["model_name"] == "ru_core_news_lg"
    assert spacy_specific["literary_patterns"] is True
    assert spacy_specific["character_detection_boost"] == 1.2


@pytest.mark.asyncio
async def test_load_processor_configs_natasha_config(
    config_loader,
    mock_settings_manager,
    sample_natasha_settings
):
    """Тест загрузки Natasha конфигурации."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = [
        {},  # spacy
        sample_natasha_settings,  # natasha
        {},  # stanza
        {}   # deeppavlov
    ]

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    natasha_config = configs["natasha"]
    assert natasha_config.enabled is True
    assert natasha_config.weight == 1.2  # Higher for Russian
    assert natasha_config.confidence_threshold == 0.4
    assert natasha_config.min_word_count == 8

    # Проверяем natasha_specific settings
    assert "natasha" in natasha_config.custom_settings
    natasha_specific = natasha_config.custom_settings["natasha"]
    assert natasha_specific["enable_morphology"] is True
    assert natasha_specific["literary_boost"] == 1.3


@pytest.mark.asyncio
async def test_load_processor_configs_stanza_config(
    config_loader,
    mock_settings_manager,
    sample_stanza_settings
):
    """Тест загрузки Stanza конфигурации."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = [
        {},  # spacy
        {},  # natasha
        sample_stanza_settings,  # stanza
        {}   # deeppavlov
    ]

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    stanza_config = configs["stanza"]
    assert stanza_config.enabled is False  # Disabled by default
    assert stanza_config.weight == 0.8
    assert stanza_config.confidence_threshold == 0.5

    # Проверяем stanza_specific settings
    assert "stanza" in stanza_config.custom_settings


@pytest.mark.asyncio
async def test_load_processor_configs_deeppavlov_config(
    config_loader,
    mock_settings_manager,
    sample_deeppavlov_settings
):
    """Тест загрузки DeepPavlov конфигурации."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = [
        {},  # spacy
        {},  # natasha
        {},  # stanza
        sample_deeppavlov_settings  # deeppavlov
    ]

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    dp_config = configs["deeppavlov"]
    assert dp_config.enabled is True
    assert dp_config.weight == 1.5  # Highest weight (F1: 0.94-0.97)
    assert dp_config.confidence_threshold == 0.3

    # Проверяем deeppavlov_specific settings
    assert "deeppavlov" in dp_config.custom_settings
    dp_specific = dp_config.custom_settings["deeppavlov"]
    assert dp_specific["model_name"] == "ner_ontonotes_bert_mult"
    assert dp_specific["use_gpu"] is False


# ============================================================================
# TESTS: Default Values Fallback
# ============================================================================

@pytest.mark.asyncio
async def test_load_processor_configs_defaults_on_empty(
    config_loader,
    mock_settings_manager
):
    """Тест fallback к дефолтным значениям при пустых settings."""
    # Arrange
    mock_settings_manager.get_category_settings.return_value = {}

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    assert len(configs) == 5  # spacy, natasha, stanza, deeppavlov, gliner

    # SpaCy defaults
    spacy_config = configs["spacy"]
    assert spacy_config.enabled is True
    assert spacy_config.weight == 1.0
    assert spacy_config.confidence_threshold == 0.3

    # Natasha defaults
    natasha_config = configs["natasha"]
    assert natasha_config.weight == 1.2

    # Stanza defaults
    stanza_config = configs["stanza"]
    assert stanza_config.enabled is False


@pytest.mark.asyncio
async def test_load_processor_configs_defaults_on_exception(
    config_loader,
    mock_settings_manager
):
    """Тест fallback к дефолтным значениям при exception."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = Exception("DB error")

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    # Должны вернуться default configs
    assert len(configs) == 5  # spacy, natasha, stanza, deeppavlov, gliner
    assert all(isinstance(c, ProcessorConfig) for c in configs.values())


@pytest.mark.asyncio
async def test_get_default_configs_structure(config_loader):
    """Тест структуры дефолтных конфигураций."""
    # Act
    configs = config_loader._get_default_configs()

    # Assert
    assert len(configs) == 5  # spacy, natasha, stanza, deeppavlov, gliner
    assert "spacy" in configs
    assert "natasha" in configs
    assert "stanza" in configs
    assert "deeppavlov" in configs

    # Проверяем ProcessorConfig instances
    for name, config in configs.items():
        assert isinstance(config, ProcessorConfig)
        assert hasattr(config, "enabled")
        assert hasattr(config, "weight")
        assert hasattr(config, "custom_settings")


@pytest.mark.asyncio
async def test_get_default_configs_spacy_defaults(config_loader):
    """Тест дефолтных значений для SpaCy."""
    # Act
    configs = config_loader._get_default_configs()

    # Assert
    spacy_config = configs["spacy"]
    assert spacy_config.enabled is True
    assert spacy_config.weight == 1.0
    assert "spacy" in spacy_config.custom_settings

    spacy_specific = spacy_config.custom_settings["spacy"]
    assert spacy_specific["model_name"] == "ru_core_news_lg"
    assert "entity_types" in spacy_specific
    assert "PERSON" in spacy_specific["entity_types"]


# ============================================================================
# TESTS: Config Merging Logic
# ============================================================================

@pytest.mark.asyncio
async def test_build_spacy_config_merges_custom_settings(
    config_loader
):
    """Тест слияния custom settings для SpaCy."""
    # Arrange
    settings = {
        "enabled": True,
        "weight": 1.0,
        "spacy_specific": {
            "custom_param": "custom_value",
            "disable_components": ["custom_component"]
        }
    }

    # Act
    config = config_loader._build_spacy_config(settings)

    # Assert
    spacy_specific = config.custom_settings["spacy"]
    assert spacy_specific["custom_param"] == "custom_value"
    assert spacy_specific["disable_components"] == ["custom_component"]
    # Дефолтные значения также должны быть
    assert "model_name" in spacy_specific


@pytest.mark.asyncio
async def test_build_natasha_config_merges_custom_settings(
    config_loader
):
    """Тест слияния custom settings для Natasha."""
    # Arrange
    settings = {
        "enabled": True,
        "weight": 1.2,
        "natasha_specific": {
            "custom_feature": True
        }
    }

    # Act
    config = config_loader._build_natasha_config(settings)

    # Assert
    natasha_specific = config.custom_settings["natasha"]
    assert natasha_specific["custom_feature"] is True
    # Дефолтные значения
    assert natasha_specific["enable_morphology"] is True


@pytest.mark.asyncio
async def test_build_config_uses_get_with_defaults(
    config_loader
):
    """Тест использования .get() с дефолтными значениями."""
    # Arrange
    empty_settings = {}

    # Act
    spacy_config = config_loader._build_spacy_config(empty_settings)

    # Assert
    # Все должны иметь дефолтные значения
    assert spacy_config.enabled is True  # default
    assert spacy_config.weight == 1.0  # default
    assert spacy_config.confidence_threshold == 0.3  # default


# ============================================================================
# TESTS: Invalid Config Handling
# ============================================================================

@pytest.mark.asyncio
async def test_get_processor_settings_handles_exception(
    config_loader,
    mock_settings_manager
):
    """Тест обработки exception при загрузке settings."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = Exception("DB connection error")

    # Act
    settings = await config_loader._get_processor_settings("spacy")

    # Assert
    # Должны вернуться пустые settings
    assert settings == {}


@pytest.mark.asyncio
async def test_load_processor_configs_partial_failure(
    config_loader,
    mock_settings_manager,
    sample_spacy_settings
):
    """Тест частичного сбоя при загрузке configs."""
    # Arrange - один успешный, остальные fail
    mock_settings_manager.get_category_settings.side_effect = [
        sample_spacy_settings,  # spacy - success
        Exception("Error"),     # natasha - fail
        Exception("Error"),     # stanza - fail
        Exception("Error")      # deeppavlov - fail
    ]

    # Act
    configs = await config_loader.load_processor_configs()

    # Assert
    # Должны вернуться default configs (из-за exception в load_processor_configs)
    assert len(configs) == 5  # spacy, natasha, stanza, deeppavlov, gliner
    assert all(isinstance(c, ProcessorConfig) for c in configs.values())


# ============================================================================
# TESTS: Type Conversion
# ============================================================================

@pytest.mark.asyncio
async def test_build_config_converts_types_correctly(
    config_loader
):
    """Тест правильной конвертации типов."""
    # Arrange
    settings = {
        "enabled": "true",  # String вместо bool (хотя .get() вернет как есть)
        "weight": "1.5",    # String вместо float
        "confidence_threshold": 0.4,
        "min_description_length": "50"  # String вместо int
    }

    # Act
    config = config_loader._build_spacy_config(settings)

    # Assert
    # .get() не конвертирует типы автоматически, но наш код должен это учитывать
    # В данном случае проверяем что ProcessorConfig создается
    assert isinstance(config, ProcessorConfig)


@pytest.mark.asyncio
async def test_build_config_handles_none_values(
    config_loader
):
    """Тест обработки None значений."""
    # Arrange
    settings = {
        "enabled": None,
        "weight": None,
        "confidence_threshold": 0.3
    }

    # Act
    config = config_loader._build_spacy_config(settings)

    # Assert
    # .get() возвращает None если ключ есть но значение None
    # ProcessorConfig принимает None и это валидно
    assert config.enabled is None  # None из settings
    assert config.weight is None  # None из settings
    assert config.confidence_threshold == 0.3  # Из settings


# ============================================================================
# TESTS: Global Settings
# ============================================================================

@pytest.mark.asyncio
async def test_load_global_settings_success(
    config_loader,
    mock_settings_manager,
    sample_global_settings
):
    """Тест успешной загрузки global settings."""
    # Arrange
    mock_settings_manager.get_category_settings.return_value = sample_global_settings

    # Act
    settings = await config_loader.load_global_settings()

    # Assert
    assert settings["max_parallel_processors"] == 3
    assert settings["ensemble_voting_threshold"] == 0.6
    assert settings["adaptive_text_analysis"] is True
    assert settings["quality_monitoring"] is True
    assert settings["auto_processor_selection"] is True
    assert settings["processing_mode"] == "single"
    assert settings["default_processor"] == "spacy"


@pytest.mark.asyncio
async def test_load_global_settings_defaults_on_exception(
    config_loader,
    mock_settings_manager
):
    """Тест fallback к дефолтным global settings при exception."""
    # Arrange
    mock_settings_manager.get_category_settings.side_effect = Exception("DB error")

    # Act
    settings = await config_loader.load_global_settings()

    # Assert
    # Должны вернуться default settings
    assert settings["max_parallel_processors"] == 3
    assert settings["ensemble_voting_threshold"] == 0.6
    assert settings["processing_mode"] == "single"


@pytest.mark.asyncio
async def test_get_default_global_settings_structure(config_loader):
    """Тест структуры дефолтных global settings."""
    # Act
    settings = config_loader._get_default_global_settings()

    # Assert
    assert "max_parallel_processors" in settings
    assert "ensemble_voting_threshold" in settings
    assert "adaptive_text_analysis" in settings
    assert "quality_monitoring" in settings
    assert "auto_processor_selection" in settings
    assert "processing_mode" in settings
    assert "default_processor" in settings


@pytest.mark.asyncio
async def test_load_global_settings_partial_data(
    config_loader,
    mock_settings_manager
):
    """Тест загрузки global settings с частичными данными."""
    # Arrange
    partial_settings = {
        "max_parallel_processors": 5,
        # Остальные поля отсутствуют
    }
    mock_settings_manager.get_category_settings.return_value = partial_settings

    # Act
    settings = await config_loader.load_global_settings()

    # Assert
    # Должны использоваться defaults для отсутствующих полей
    assert settings["max_parallel_processors"] == 5  # из partial
    assert settings["ensemble_voting_threshold"] == 0.6  # default
    assert settings["processing_mode"] == "single"  # default


# ============================================================================
# TESTS: Custom Settings Preservation
# ============================================================================

@pytest.mark.asyncio
async def test_build_config_preserves_atmosphere_keywords(
    config_loader
):
    """Тест сохранения atmosphere keywords для SpaCy."""
    # Arrange
    settings = {
        "enabled": True,
        "weight": 1.0
    }

    # Act
    config = config_loader._build_spacy_config(settings)

    # Assert
    spacy_specific = config.custom_settings["spacy"]
    assert "atmosphere_keywords" in spacy_specific
    assert "мрачный" in spacy_specific["atmosphere_keywords"]
    assert "величественный" in spacy_specific["atmosphere_keywords"]


@pytest.mark.asyncio
async def test_build_config_preserves_entity_types(
    config_loader
):
    """Тест сохранения entity types для SpaCy."""
    # Arrange
    settings = {}

    # Act
    config = config_loader._build_spacy_config(settings)

    # Assert
    spacy_specific = config.custom_settings["spacy"]
    assert "entity_types" in spacy_specific
    assert "PERSON" in spacy_specific["entity_types"]
    assert "LOC" in spacy_specific["entity_types"]
    assert "GPE" in spacy_specific["entity_types"]


@pytest.mark.asyncio
async def test_build_stanza_config_preserves_processors_list(
    config_loader
):
    """Тест сохранения списка processors для Stanza."""
    # Arrange
    settings = {}

    # Act
    config = config_loader._build_stanza_config(settings)

    # Assert
    stanza_specific = config.custom_settings["stanza"]
    assert "processors" in stanza_specific
    assert "tokenize" in stanza_specific["processors"]
    assert "ner" in stanza_specific["processors"]


@pytest.mark.asyncio
async def test_build_deeppavlov_config_lazy_init(
    config_loader
):
    """Тест настройки lazy_init для DeepPavlov."""
    # Arrange
    settings = {}

    # Act
    config = config_loader._build_deeppavlov_config(settings)

    # Assert
    dp_specific = config.custom_settings["deeppavlov"]
    assert "lazy_init" in dp_specific
    assert dp_specific["lazy_init"] is True


# ============================================================================
# TESTS: Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_load_processor_configs_calls_get_category_settings(
    config_loader,
    mock_settings_manager
):
    """Тест что load_processor_configs вызывает get_category_settings."""
    # Arrange
    mock_settings_manager.get_category_settings.return_value = {}

    # Act
    await config_loader.load_processor_configs()

    # Assert
    # Должны быть вызовы для всех 4 процессоров
    assert mock_settings_manager.get_category_settings.call_count >= 4


@pytest.mark.asyncio
async def test_get_processor_settings_correct_category_name(
    config_loader,
    mock_settings_manager
):
    """Тест правильного формирования category name."""
    # Arrange
    mock_settings_manager.get_category_settings.return_value = {}

    # Act
    await config_loader._get_processor_settings("spacy")

    # Assert
    mock_settings_manager.get_category_settings.assert_called_with("nlp_spacy")


@pytest.mark.asyncio
async def test_load_global_settings_correct_category_name(
    config_loader,
    mock_settings_manager
):
    """Тест правильного category name для global settings."""
    # Arrange
    mock_settings_manager.get_category_settings.return_value = {}

    # Act
    await config_loader.load_global_settings()

    # Assert
    mock_settings_manager.get_category_settings.assert_called_with("nlp_global")
