"""
Processor Registry - manages NLP processor instances.
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)


@dataclass
class ProcessorConfig:
    """Configuration for NLP processor."""

    enabled: bool = True
    weight: float = 1.0
    confidence_threshold: float = 0.3
    min_description_length: int = 50
    max_description_length: int = 1000
    min_word_count: int = 10
    custom_settings: Dict[str, Any] = None

    def __post_init__(self):
        if self.custom_settings is None:
            self.custom_settings = {}


class ProcessorRegistry:
    """Registry for managing NLP processor instances."""

    def __init__(self):
        self.processors: Dict[str, Any] = {}
        self.processor_configs: Dict[str, ProcessorConfig] = {}
        self._initialized = False

    async def initialize(self, config_loader):
        """
        Initialize all processors with configurations.

        Args:
            config_loader: ConfigLoader instance to load settings
        """
        if self._initialized:
            logger.info("ProcessorRegistry already initialized")
            return

        logger.info("Initializing ProcessorRegistry...")

        # Load configurations
        self.processor_configs = await config_loader.load_processor_configs()

        # Initialize processors
        await self._initialize_processors()

        self._initialized = True
        logger.info(
            f"✅ ProcessorRegistry initialized with {len(self.processors)} processors"
        )

    async def _initialize_processors(self):
        """Initialize all enabled processors."""
        # Import here to avoid circular dependencies
        from ...enhanced_nlp_system import EnhancedSpacyProcessor
        from ...natasha_processor import EnhancedNatashaProcessor
        from ...stanza_processor import EnhancedStanzaProcessor
        from ...deeppavlov_processor import DeepPavlovProcessor

        for processor_name, config in self.processor_configs.items():
            if not config.enabled:
                logger.info(f"Processor {processor_name} is disabled, skipping")
                continue

            try:
                if processor_name == "spacy":
                    processor = EnhancedSpacyProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors["spacy"] = processor
                        logger.info("✅ SpaCy processor initialized")

                elif processor_name == "natasha":
                    processor = EnhancedNatashaProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors["natasha"] = processor
                        logger.info("✅ Natasha processor initialized")

                elif processor_name == "stanza":
                    processor = EnhancedStanzaProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors["stanza"] = processor
                        logger.info("✅ Stanza processor initialized")

                elif processor_name == "deeppavlov":
                    # NEW: DeepPavlov processor - F1 0.94-0.97!
                    processor = DeepPavlovProcessor(use_gpu=False)
                    if processor.is_available():
                        self.processors["deeppavlov"] = processor
                        logger.info("✅ DeepPavlov processor initialized (F1 0.94-0.97)")
                    else:
                        logger.warning("DeepPavlov not available - install with: pip install deeppavlov")

            except Exception as e:
                logger.error(f"Failed to initialize {processor_name} processor: {e}")

    def get_processor(self, name: str) -> Optional[Any]:
        """Get processor by name."""
        return self.processors.get(name)

    def get_all_processors(self) -> Dict[str, Any]:
        """Get all available processors."""
        return self.processors.copy()

    def get_processor_config(self, name: str) -> Optional[ProcessorConfig]:
        """Get configuration for a processor."""
        return self.processor_configs.get(name)

    async def update_processor_config(
        self, processor_name: str, new_config: Dict[str, Any], settings_manager
    ) -> bool:
        """
        Update processor configuration.

        Args:
            processor_name: Name of the processor
            new_config: New configuration dictionary
            settings_manager: SettingsManager instance for persistence

        Returns:
            True if update successful
        """
        try:
            if processor_name in self.processor_configs:
                # Update configuration
                config = self.processor_configs[processor_name]
                for key, value in new_config.items():
                    if hasattr(config, key):
                        setattr(config, key, value)

                # Save to database
                await settings_manager.set_category_settings(
                    f"nlp_{processor_name}", new_config
                )

                # Reinitialize processor if needed
                if processor_name in self.processors:
                    processor = self.processors[processor_name]
                    await processor.load_model()

                logger.info(f"✅ Updated config for {processor_name} processor")
                return True

        except Exception as e:
            logger.error(f"Failed to update {processor_name} config: {e}")

        return False

    def get_status(self) -> Dict[str, Any]:
        """Get status of all processors."""
        status = {
            "available_processors": list(self.processors.keys()),
            "processor_details": {},
        }

        for name, processor in self.processors.items():
            status["processor_details"][name] = {
                "type": processor.processor_type.value
                if hasattr(processor, "processor_type")
                else "unknown",
                "loaded": processor.loaded if hasattr(processor, "loaded") else False,
                "available": processor.is_available()
                if hasattr(processor, "is_available")
                else False,
                "performance_metrics": processor.get_performance_metrics()
                if hasattr(processor, "get_performance_metrics")
                else {},
                "config": asdict(self.processor_configs.get(name, ProcessorConfig())),
            }

        return status

    def is_initialized(self) -> bool:
        """Check if registry is initialized."""
        return self._initialized
