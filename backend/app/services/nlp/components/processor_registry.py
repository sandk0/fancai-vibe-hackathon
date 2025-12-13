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
        import os

        # Check if NLP processors are disabled (lite mode - LangExtract only)
        use_nlp_processors = os.getenv("USE_NLP_PROCESSORS", "true").lower() == "true"
        use_langextract = os.getenv("USE_LANGEXTRACT_PRIMARY", "false").lower() == "true"

        if not use_nlp_processors or use_langextract:
            logger.info(
                f"⏭️  NLP processors disabled (USE_NLP_PROCESSORS={use_nlp_processors}, "
                f"USE_LANGEXTRACT_PRIMARY={use_langextract}). Using LangExtract only."
            )
            return

        # Import here to avoid circular dependencies
        # These imports are safe now because NLP libraries use dynamic imports
        # Wrap in try-except to handle missing NLP libraries in lite mode
        try:
            from ...enhanced_nlp_system import EnhancedSpacyProcessor
            from ...natasha_processor import EnhancedNatashaProcessor
            from ...stanza_processor import EnhancedStanzaProcessor
            from ...deeppavlov_processor import DeepPavlovProcessor
            from ...gliner_processor import GLiNERProcessor
        except ImportError as e:
            logger.error(
                f"❌ Failed to import NLP processors: {e}. "
                f"USE_NLP_PROCESSORS is enabled but NLP libraries not installed. "
                f"Set USE_NLP_PROCESSORS=false and USE_LANGEXTRACT_PRIMARY=true for lite mode."
            )
            # Don't raise - just return with no processors initialized
            return

        initialization_attempts = 0
        successful_initializations = 0

        for processor_name, config in self.processor_configs.items():
            if not config.enabled:
                logger.info(f"⏭️  Processor {processor_name} is disabled, skipping")
                continue

            initialization_attempts += 1
            logger.info(f"🔄 Attempting to initialize {processor_name} processor...")

            try:
                processor = None

                if processor_name == "spacy":
                    processor = EnhancedSpacyProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors["spacy"] = processor
                        successful_initializations += 1
                        logger.info("✅ SpaCy processor initialized successfully")
                    else:
                        logger.warning(
                            f"⚠️  SpaCy processor loaded but not available. "
                            f"Check model installation: python -m spacy download ru_core_news_lg"
                        )

                elif processor_name == "natasha":
                    processor = EnhancedNatashaProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors["natasha"] = processor
                        successful_initializations += 1
                        logger.info("✅ Natasha processor initialized successfully")
                    else:
                        logger.warning(
                            f"⚠️  Natasha processor loaded but not available. "
                            f"Check installation: pip install natasha"
                        )

                elif processor_name == "stanza":
                    processor = EnhancedStanzaProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors["stanza"] = processor
                        successful_initializations += 1
                        logger.info("✅ Stanza processor initialized successfully")
                    else:
                        logger.warning(
                            f"⚠️  Stanza processor loaded but not available. "
                            f"Check model installation: python -c 'import stanza; stanza.download(\"ru\")'"
                        )

                elif processor_name == "gliner":
                    # NEW: GLiNER processor - F1 0.90-0.95, no dependency conflicts!
                    processor = GLiNERProcessor(config)
                    await processor.load_model()
                    if processor.is_available():
                        self.processors["gliner"] = processor
                        successful_initializations += 1
                        logger.info(
                            "✅ GLiNER processor initialized successfully (F1 0.90-0.95, zero-shot NER)"
                        )
                    else:
                        logger.warning(
                            f"⚠️  GLiNER not available. "
                            f"Install with: pip install gliner>=0.2.0"
                        )

                elif processor_name == "deeppavlov":
                    # DeepPavlov processor - F1 0.94-0.97 but has dependency conflicts
                    processor = DeepPavlovProcessor(use_gpu=False)
                    if processor.is_available():
                        self.processors["deeppavlov"] = processor
                        successful_initializations += 1
                        logger.info(
                            "✅ DeepPavlov processor initialized successfully (F1 0.94-0.97)"
                        )
                    else:
                        logger.warning(
                            f"⚠️  DeepPavlov not available - has dependency conflicts. "
                            f"Using GLiNER as replacement (F1 0.90-0.95, no conflicts)"
                        )

            except Exception as e:
                logger.error(
                    f"❌ Failed to initialize {processor_name} processor: {type(e).__name__}: {e}",
                    exc_info=True
                )

        # Validation: Ensure minimum 2 processors loaded for ensemble voting
        logger.info(
            f"📊 Processor initialization complete: {successful_initializations}/{initialization_attempts} successful"
        )

        if len(self.processors) < 2:
            # In lite mode (USE_LANGEXTRACT_PRIMARY=true), this is expected - no NLP processors
            if use_langextract:
                logger.info(
                    f"ℹ️  No NLP processors loaded (lite mode). Using LangExtract as primary parser."
                )
            else:
                error_msg = (
                    f"❌ CRITICAL: Only {len(self.processors)} processor(s) loaded - "
                    f"need at least 2 for ensemble voting. "
                    f"Available: {list(self.processors.keys())}. "
                    f"Check processor installations and configurations."
                )
                logger.error(error_msg)
                raise RuntimeError(error_msg)
        else:
            logger.info(
                f"✅ Sufficient processors loaded: {list(self.processors.keys())}"
            )

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
                "type": (
                    processor.processor_type.value
                    if hasattr(processor, "processor_type")
                    else "unknown"
                ),
                "loaded": processor.loaded if hasattr(processor, "loaded") else False,
                "available": (
                    processor.is_available()
                    if hasattr(processor, "is_available")
                    else False
                ),
                "performance_metrics": (
                    processor.get_performance_metrics()
                    if hasattr(processor, "get_performance_metrics")
                    else {}
                ),
                "config": asdict(self.processor_configs.get(name, ProcessorConfig())),
            }

        return status

    def is_initialized(self) -> bool:
        """Check if registry is initialized."""
        return self._initialized
