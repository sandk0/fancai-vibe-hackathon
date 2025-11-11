"""
Config Loader - loads and validates processor configurations.
"""

import logging
from typing import Dict, Any

from .processor_registry import ProcessorConfig

logger = logging.getLogger(__name__)


class ConfigLoader:
    """Loads and validates NLP processor configurations."""

    def __init__(self, settings_manager):
        """
        Initialize config loader.

        Args:
            settings_manager: Settings manager for database access
        """
        self.settings_manager = settings_manager

    async def load_processor_configs(self) -> Dict[str, ProcessorConfig]:
        """
        Load configurations for all processors from database.

        Returns:
            Dictionary mapping processor names to ProcessorConfig objects
        """
        try:
            # SpaCy configuration
            spacy_settings = await self._get_processor_settings("spacy")
            spacy_config = self._build_spacy_config(spacy_settings)

            # Natasha configuration
            natasha_settings = await self._get_processor_settings("natasha")
            natasha_config = self._build_natasha_config(natasha_settings)

            # Stanza configuration
            stanza_settings = await self._get_processor_settings("stanza")
            stanza_config = self._build_stanza_config(stanza_settings)

            # DeepPavlov configuration (NEW from Perplexity!)
            deeppavlov_settings = await self._get_processor_settings("deeppavlov")
            deeppavlov_config = self._build_deeppavlov_config(deeppavlov_settings)

            configs = {
                "spacy": spacy_config,
                "natasha": natasha_config,
                "stanza": stanza_config,
                "deeppavlov": deeppavlov_config,  # NEW!
            }

            logger.info("✅ Loaded configurations for all processors (including DeepPavlov)")
            return configs

        except Exception as e:
            logger.warning(f"Failed to load processor configs: {e}")
            # Return default configurations
            return self._get_default_configs()

    async def _get_processor_settings(self, processor_name: str) -> Dict[str, Any]:
        """Get settings for a specific processor from database."""
        try:
            settings = await self.settings_manager.get_category_settings(
                f"nlp_{processor_name}"
            )
            return settings
        except Exception as e:
            logger.warning(f"Failed to load settings for {processor_name}: {e}")
            return {}

    def _build_spacy_config(self, settings: Dict[str, Any]) -> ProcessorConfig:
        """Build SpaCy processor configuration."""
        # Build full spaCy configuration
        spacy_specific = {
            "model_name": settings.get("model_name", "ru_core_news_lg"),
            "disable_components": [],
            "entity_types": ["PERSON", "LOC", "GPE", "FAC", "ORG"],
            "literary_patterns": settings.get("literary_patterns", True),
            "character_detection_boost": settings.get("character_detection_boost", 1.2),
            "location_detection_boost": settings.get("location_detection_boost", 1.1),
            "atmosphere_keywords": [
                "мрачный",
                "светлый",
                "таинственный",
                "величественный",
                "уютный",
            ],
        }
        # Merge with any custom settings
        spacy_specific.update(settings.get("spacy_specific", {}))

        return ProcessorConfig(
            enabled=settings.get("enabled", True),
            weight=settings.get("weight", 1.0),
            confidence_threshold=settings.get("confidence_threshold", 0.3),
            min_description_length=settings.get("min_description_length", 50),
            max_description_length=settings.get("max_description_length", 1000),
            min_word_count=settings.get("min_word_count", 10),
            custom_settings={"spacy": spacy_specific},
        )

    def _build_natasha_config(self, settings: Dict[str, Any]) -> ProcessorConfig:
        """Build Natasha processor configuration."""
        natasha_specific = {
            "enable_morphology": True,
            "enable_syntax": True,
            "enable_ner": True,
            "literary_boost": settings.get("literary_boost", 1.3),
        }
        natasha_specific.update(settings.get("natasha_specific", {}))

        return ProcessorConfig(
            enabled=settings.get("enabled", True),
            weight=settings.get("weight", 1.2),  # Natasha better for Russian
            confidence_threshold=settings.get("confidence_threshold", 0.4),
            min_description_length=settings.get("min_description_length", 40),
            max_description_length=settings.get("max_description_length", 1200),
            min_word_count=settings.get("min_word_count", 8),
            custom_settings={"natasha": natasha_specific},
        )

    def _build_stanza_config(self, settings: Dict[str, Any]) -> ProcessorConfig:
        """Build Stanza processor configuration."""
        stanza_specific = {
            "model_name": "ru",
            "processors": ["tokenize", "pos", "lemma", "ner", "depparse"],
            "complex_syntax_analysis": True,
            "dependency_parsing": True,
        }
        stanza_specific.update(settings.get("stanza_specific", {}))

        return ProcessorConfig(
            enabled=settings.get("enabled", False),  # Disabled by default
            weight=settings.get("weight", 0.8),
            confidence_threshold=settings.get("confidence_threshold", 0.5),
            custom_settings={"stanza": stanza_specific},
        )

    def _build_deeppavlov_config(self, settings: Dict[str, Any]) -> ProcessorConfig:
        """Build DeepPavlov processor configuration."""
        deeppavlov_specific = {
            "model_name": settings.get("model_name", "ner_ontonotes_bert_mult"),
            "use_gpu": settings.get("use_gpu", False),
            "lazy_init": True,
        }
        deeppavlov_specific.update(settings.get("deeppavlov_specific", {}))

        return ProcessorConfig(
            enabled=settings.get("enabled", True),
            weight=settings.get("weight", 1.5),  # Highest weight due to F1 0.94-0.97
            confidence_threshold=settings.get("confidence_threshold", 0.3),
            min_description_length=settings.get("min_description_length", 50),
            max_description_length=settings.get("max_description_length", 1000),
            min_word_count=settings.get("min_word_count", 10),
            custom_settings={"deeppavlov": deeppavlov_specific},
        )

    def _get_default_configs(self) -> Dict[str, ProcessorConfig]:
        """Get default configurations for all processors."""
        logger.info("Using default processor configurations")

        return {
            "spacy": ProcessorConfig(
                enabled=True,
                weight=1.0,
                custom_settings={
                    "spacy": {
                        "model_name": "ru_core_news_lg",
                        "disable_components": [],
                        "entity_types": ["PERSON", "LOC", "GPE", "FAC", "ORG"],
                        "literary_patterns": True,
                        "character_detection_boost": 1.2,
                        "location_detection_boost": 1.1,
                        "atmosphere_keywords": [
                            "мрачный",
                            "светлый",
                            "таинственный",
                            "величественный",
                            "уютный",
                        ],
                    }
                },
            ),
            "natasha": ProcessorConfig(
                enabled=True,
                weight=1.2,
                custom_settings={
                    "natasha": {
                        "enable_morphology": True,
                        "enable_syntax": True,
                        "enable_ner": True,
                        "literary_boost": 1.3,
                    }
                },
            ),
            "stanza": ProcessorConfig(
                enabled=False, weight=0.8, custom_settings={"stanza": {}}
            ),
            "deeppavlov": ProcessorConfig(
                enabled=True,
                weight=1.5,  # Highest weight due to F1 0.94-0.97
                custom_settings={
                    "deeppavlov": {
                        "model_name": "ner_ontonotes_bert_mult",
                        "use_gpu": False,
                        "lazy_init": True,
                    }
                },
            ),
        }

    async def load_global_settings(self) -> Dict[str, Any]:
        """Load global NLP settings."""
        try:
            global_settings = await self.settings_manager.get_category_settings(
                "nlp_global"
            )
            return {
                "max_parallel_processors": global_settings.get(
                    "max_parallel_processors", 3
                ),
                "ensemble_voting_threshold": global_settings.get(
                    "ensemble_voting_threshold", 0.6
                ),
                "adaptive_text_analysis": global_settings.get(
                    "adaptive_text_analysis", True
                ),
                "quality_monitoring": global_settings.get("quality_monitoring", True),
                "auto_processor_selection": global_settings.get(
                    "auto_processor_selection", True
                ),
                "processing_mode": global_settings.get("processing_mode", "single"),
                "default_processor": global_settings.get("default_processor", "spacy"),
            }
        except Exception as e:
            logger.warning(f"Failed to load global settings: {e}")
            return self._get_default_global_settings()

    def _get_default_global_settings(self) -> Dict[str, Any]:
        """Get default global settings."""
        return {
            "max_parallel_processors": 3,
            "ensemble_voting_threshold": 0.6,
            "adaptive_text_analysis": True,
            "quality_monitoring": True,
            "auto_processor_selection": True,
            "processing_mode": "single",
            "default_processor": "spacy",
        }
