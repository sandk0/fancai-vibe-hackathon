"""
Comprehensive tests for ConfigLoader - loads and validates processor configurations.

Target coverage: 85%+ for config_loader.py
Total tests: 18 comprehensive tests covering:
- Global settings loading
- Processor-specific configuration
- Validation and error handling
- Default fallbacks
- Configuration updates
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from typing import Dict, Any

from app.services.nlp.components.config_loader import ConfigLoader
from app.services.nlp.components.processor_registry import ProcessorConfig


# ============================================================================
# FIXTURES
# ============================================================================


@pytest.fixture
def mock_settings_manager():
    """Mock settings_manager для ConfigLoader."""
    manager = AsyncMock()
    return manager


@pytest.fixture
def config_loader(mock_settings_manager):
    """Fixture для ConfigLoader с mock settings_manager."""
    return ConfigLoader(mock_settings_manager)


@pytest.fixture
def sample_spacy_settings():
    """Sample SpaCy configuration из settings manager."""
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
        "location_detection_boost": 1.1
    }


@pytest.fixture
def sample_natasha_settings():
    """Sample Natasha configuration из settings manager."""
    return {
        "enabled": True,
        "weight": 1.2,
        "confidence_threshold": 0.4,
        "min_description_length": 40,
        "max_description_length": 1200,
        "min_word_count": 8,
        "literary_boost": 1.3
    }


@pytest.fixture
def sample_stanza_settings():
    """Sample Stanza configuration из settings manager."""
    return {
        "enabled": False,
        "weight": 0.8,
        "confidence_threshold": 0.5,
        "model_name": "ru"
    }


@pytest.fixture
def sample_deeppavlov_settings():
    """Sample DeepPavlov configuration из settings manager."""
    return {
        "enabled": True,
        "weight": 1.5,
        "confidence_threshold": 0.3,
        "min_description_length": 50,
        "max_description_length": 1000,
        "min_word_count": 10,
        "model_name": "ner_ontonotes_bert_mult"
    }


@pytest.fixture
def sample_global_settings():
    """Sample глобальных NLP settings."""
    return {
        "max_parallel_processors": 3,
        "ensemble_voting_threshold": 0.6,
        "adaptive_text_analysis": True,
        "quality_monitoring": True,
        "auto_processor_selection": True,
        "processing_mode": "ensemble",
        "default_processor": "natasha"
    }


# ============================================================================
# TEST CLASS 1: INITIALIZATION
# ============================================================================


class TestConfigLoaderInitialization:
    """Тесты инициализации ConfigLoader."""

    def test_config_loader_initialization(self, config_loader):
        """Тест успешной инициализации ConfigLoader."""
        assert config_loader is not None
        assert config_loader.settings_manager is not None

    def test_config_loader_with_different_managers(self):
        """Тест ConfigLoader с different settings managers."""
        manager1 = AsyncMock()
        manager2 = AsyncMock()

        loader1 = ConfigLoader(manager1)
        loader2 = ConfigLoader(manager2)

        assert loader1.settings_manager is manager1
        assert loader2.settings_manager is manager2


# ============================================================================
# TEST CLASS 2: PROCESSOR CONFIGURATION LOADING
# ============================================================================


class TestConfigLoaderProcessorConfigLoading:
    """Тесты loading processor configurations."""

    @pytest.mark.asyncio
    async def test_load_processor_configs_success(
        self, config_loader, mock_settings_manager,
        sample_spacy_settings, sample_natasha_settings,
        sample_stanza_settings, sample_deeppavlov_settings
    ):
        """Тест successful loading всех processor configs."""
        # Setup mock to return settings
        async def mock_get_settings(category):
            settings_map = {
                "nlp_spacy": sample_spacy_settings,
                "nlp_natasha": sample_natasha_settings,
                "nlp_stanza": sample_stanza_settings,
                "nlp_deeppavlov": sample_deeppavlov_settings
            }
            return settings_map.get(category, {})

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()

        # Should load all 4 processors
        assert "spacy" in configs
        assert "natasha" in configs
        assert "stanza" in configs
        assert "deeppavlov" in configs

    @pytest.mark.asyncio
    async def test_load_spacy_config(
        self, config_loader, mock_settings_manager, sample_spacy_settings
    ):
        """Тест loading SpaCy configuration."""
        async def mock_get_settings(category):
            if category == "nlp_spacy":
                return sample_spacy_settings
            return {}

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()
        spacy_config = configs["spacy"]

        assert isinstance(spacy_config, ProcessorConfig)
        assert spacy_config.enabled is True
        assert spacy_config.weight == 1.0
        assert spacy_config.confidence_threshold == 0.3
        assert spacy_config.min_description_length == 50
        assert spacy_config.custom_settings["spacy"]["model_name"] == "ru_core_news_lg"

    @pytest.mark.asyncio
    async def test_load_natasha_config(
        self, config_loader, mock_settings_manager, sample_natasha_settings
    ):
        """Тест loading Natasha configuration."""
        async def mock_get_settings(category):
            if category == "nlp_natasha":
                return sample_natasha_settings
            return {}

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()
        natasha_config = configs["natasha"]

        assert isinstance(natasha_config, ProcessorConfig)
        assert natasha_config.enabled is True
        assert natasha_config.weight == 1.2  # Higher weight for Russian
        assert natasha_config.confidence_threshold == 0.4

    @pytest.mark.asyncio
    async def test_load_stanza_config(
        self, config_loader, mock_settings_manager, sample_stanza_settings
    ):
        """Тест loading Stanza configuration."""
        async def mock_get_settings(category):
            if category == "nlp_stanza":
                return sample_stanza_settings
            return {}

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()
        stanza_config = configs["stanza"]

        assert isinstance(stanza_config, ProcessorConfig)
        assert stanza_config.enabled is False  # Disabled by default
        assert stanza_config.weight == 0.8

    @pytest.mark.asyncio
    async def test_load_deeppavlov_config(
        self, config_loader, mock_settings_manager, sample_deeppavlov_settings
    ):
        """Тест loading DeepPavlov configuration."""
        async def mock_get_settings(category):
            if category == "nlp_deeppavlov":
                return sample_deeppavlov_settings
            return {}

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()
        deeppavlov_config = configs["deeppavlov"]

        assert isinstance(deeppavlov_config, ProcessorConfig)
        assert deeppavlov_config.enabled is True
        assert deeppavlov_config.weight == 1.5  # Highest weight


# ============================================================================
# TEST CLASS 3: GLOBAL SETTINGS LOADING
# ============================================================================


class TestConfigLoaderGlobalSettings:
    """Тесты loading global NLP settings."""

    @pytest.mark.asyncio
    async def test_load_global_settings_success(
        self, config_loader, mock_settings_manager, sample_global_settings
    ):
        """Тест successful loading глобальных settings."""
        mock_settings_manager.get_category_settings.return_value = sample_global_settings

        settings = await config_loader.load_global_settings()

        assert settings["max_parallel_processors"] == 3
        assert settings["ensemble_voting_threshold"] == 0.6
        assert settings["adaptive_text_analysis"] is True
        assert settings["quality_monitoring"] is True
        assert settings["auto_processor_selection"] is True
        assert settings["processing_mode"] == "ensemble"
        assert settings["default_processor"] == "natasha"

    @pytest.mark.asyncio
    async def test_load_global_settings_default_values(
        self, config_loader, mock_settings_manager
    ):
        """Тест default values когда settings manager returns empty dict."""
        mock_settings_manager.get_category_settings.return_value = {}

        settings = await config_loader.load_global_settings()

        # Should return defaults
        assert settings["max_parallel_processors"] == 3
        assert settings["ensemble_voting_threshold"] == 0.6
        assert settings["adaptive_text_analysis"] is True
        assert settings["processing_mode"] == "single"
        assert settings["default_processor"] == "spacy"

    @pytest.mark.asyncio
    async def test_load_global_settings_partial_override(
        self, config_loader, mock_settings_manager
    ):
        """Тест partial override глобальных settings."""
        mock_settings_manager.get_category_settings.return_value = {
            "ensemble_voting_threshold": 0.8,
            "processing_mode": "parallel"
            # Other settings use defaults
        }

        settings = await config_loader.load_global_settings()

        # Custom values
        assert settings["ensemble_voting_threshold"] == 0.8
        assert settings["processing_mode"] == "parallel"

        # Default values
        assert settings["max_parallel_processors"] == 3
        assert settings["default_processor"] == "spacy"


# ============================================================================
# TEST CLASS 4: ERROR HANDLING & FALLBACKS
# ============================================================================


class TestConfigLoaderErrorHandling:
    """Тесты error handling и fallback mechanisms."""

    @pytest.mark.asyncio
    async def test_processor_loading_error_fallback(
        self, config_loader, mock_settings_manager
    ):
        """Тест что settings manager exception returns defaults."""
        mock_settings_manager.get_category_settings.side_effect = Exception(
            "Database connection error"
        )

        # Should not raise, should return defaults
        configs = await config_loader.load_processor_configs()

        assert "spacy" in configs
        assert "natasha" in configs
        assert "stanza" in configs
        assert "deeppavlov" in configs
        assert configs["spacy"].enabled is True
        assert configs["spacy"].weight == 1.0

    @pytest.mark.asyncio
    async def test_global_settings_loading_error_fallback(
        self, config_loader, mock_settings_manager
    ):
        """Тест что global settings error returns defaults."""
        mock_settings_manager.get_category_settings.side_effect = Exception(
            "Database connection error"
        )

        settings = await config_loader.load_global_settings()

        # Should use defaults
        assert settings["ensemble_voting_threshold"] == 0.6
        assert settings["processing_mode"] == "single"

    @pytest.mark.asyncio
    async def test_partial_processor_settings_failure(
        self, config_loader, mock_settings_manager,
        sample_spacy_settings, sample_natasha_settings
    ):
        """Тест когда только некоторые processor settings fail."""
        call_count = 0

        async def mock_get_settings(category):
            nonlocal call_count
            call_count += 1

            if category == "nlp_spacy":
                return sample_spacy_settings
            elif category == "nlp_natasha":
                return sample_natasha_settings
            else:
                raise Exception(f"Failed to load {category}")

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()

        # Should still return defaults for failed ones
        assert "spacy" in configs
        assert "natasha" in configs
        assert "stanza" in configs


# ============================================================================
# TEST CLASS 5: CONFIGURATION VALIDATION
# ============================================================================


class TestConfigLoaderValidation:
    """Тесты configuration validation."""

    @pytest.mark.asyncio
    async def test_processor_config_field_types(
        self, config_loader, mock_settings_manager, sample_spacy_settings
    ):
        """Тест что processor config fields имеют correct types."""
        async def mock_get_settings(category):
            if category == "nlp_spacy":
                return sample_spacy_settings
            return {}

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()
        spacy_config = configs["spacy"]

        assert isinstance(spacy_config.enabled, bool)
        assert isinstance(spacy_config.weight, (int, float))
        assert isinstance(spacy_config.confidence_threshold, (int, float))
        assert isinstance(spacy_config.min_description_length, int)
        assert isinstance(spacy_config.max_description_length, int)
        assert isinstance(spacy_config.custom_settings, dict)

    @pytest.mark.asyncio
    async def test_custom_settings_preserved(
        self, config_loader, mock_settings_manager
    ):
        """Тест что custom settings не теряются при loading."""
        spacy_settings = {
            "enabled": True,
            "weight": 1.0,
            "spacy_specific": {
                "custom_entity_types": ["PERSON", "LOC"],
                "custom_weight": 0.5
            }
        }

        async def mock_get_settings(category):
            if category == "nlp_spacy":
                return spacy_settings
            return {}

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()
        spacy_config = configs["spacy"]

        # Custom settings should be merged
        assert "spacy" in spacy_config.custom_settings


# ============================================================================
# TEST CLASS 6: INTEGRATION SCENARIOS
# ============================================================================


class TestConfigLoaderIntegrationScenarios:
    """Тесты real-world integration scenarios."""

    @pytest.mark.asyncio
    async def test_full_config_loading_pipeline(
        self, config_loader, mock_settings_manager,
        sample_spacy_settings, sample_natasha_settings,
        sample_stanza_settings, sample_deeppavlov_settings,
        sample_global_settings
    ):
        """Тест полного pipeline loading processor и global configs."""
        call_count = {}

        async def mock_get_settings(category):
            settings_map = {
                "nlp_spacy": sample_spacy_settings,
                "nlp_natasha": sample_natasha_settings,
                "nlp_stanza": sample_stanza_settings,
                "nlp_deeppavlov": sample_deeppavlov_settings,
                "nlp_global": sample_global_settings
            }
            return settings_map.get(category, {})

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        # Load processor configs
        processor_configs = await config_loader.load_processor_configs()
        global_settings = await config_loader.load_global_settings()

        # Verify both loaded
        assert len(processor_configs) == 4
        assert global_settings["ensemble_voting_threshold"] == 0.6

    @pytest.mark.asyncio
    async def test_default_configs_structure(self, config_loader):
        """Тест что default configs имеют правильную структуру."""
        default_configs = config_loader._get_default_configs()

        for processor_name, config in default_configs.items():
            assert isinstance(config, ProcessorConfig)
            assert hasattr(config, "enabled")
            assert hasattr(config, "weight")
            assert hasattr(config, "custom_settings")

    @pytest.mark.asyncio
    async def test_default_global_settings_structure(self, config_loader):
        """Тест что default global settings имеют правильную структуру."""
        default_settings = config_loader._get_default_global_settings()

        assert "max_parallel_processors" in default_settings
        assert "ensemble_voting_threshold" in default_settings
        assert "processing_mode" in default_settings
        assert "default_processor" in default_settings

    @pytest.mark.asyncio
    async def test_weight_hierarchy(
        self, config_loader, mock_settings_manager,
        sample_spacy_settings, sample_natasha_settings,
        sample_stanza_settings, sample_deeppavlov_settings
    ):
        """Тест что weights hierarchy maintained: DeepPavlov > Natasha > SpaCy > Stanza."""
        async def mock_get_settings(category):
            settings_map = {
                "nlp_spacy": sample_spacy_settings,
                "nlp_natasha": sample_natasha_settings,
                "nlp_stanza": sample_stanza_settings,
                "nlp_deeppavlov": sample_deeppavlov_settings
            }
            return settings_map.get(category, {})

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        configs = await config_loader.load_processor_configs()

        spacy_weight = configs["spacy"].weight
        natasha_weight = configs["natasha"].weight
        stanza_weight = configs["stanza"].weight
        deeppavlov_weight = configs["deeppavlov"].weight

        # Verify weight hierarchy
        assert deeppavlov_weight > natasha_weight
        assert natasha_weight > spacy_weight
        assert spacy_weight > stanza_weight

    @pytest.mark.asyncio
    async def test_empty_settings_fallback(self, config_loader, mock_settings_manager):
        """Тест fallback к defaults когда все settings пустые."""
        mock_settings_manager.get_category_settings.return_value = {}

        processor_configs = await config_loader.load_processor_configs()
        global_settings = await config_loader.load_global_settings()

        # Should have sensible defaults
        assert processor_configs["spacy"].weight == 1.0
        assert processor_configs["natasha"].weight == 1.2
        assert global_settings["ensemble_voting_threshold"] == 0.6
        assert global_settings["processing_mode"] == "single"

    @pytest.mark.asyncio
    async def test_processor_config_for_ensemble_voting(
        self, config_loader, mock_settings_manager,
        sample_spacy_settings, sample_natasha_settings
    ):
        """Тест что configs proper для ensemble voting."""
        async def mock_get_settings(category):
            settings_map = {
                "nlp_spacy": sample_spacy_settings,
                "nlp_natasha": sample_natasha_settings
            }
            return settings_map.get(category, {})

        mock_settings_manager.get_category_settings.side_effect = mock_get_settings

        processor_configs = await config_loader.load_processor_configs()

        # All should have proper configuration for ensemble
        for processor_name, config in processor_configs.items():
            assert config.weight > 0  # Positive weight for voting
            assert hasattr(config, "confidence_threshold")
            assert isinstance(config.custom_settings, dict)
