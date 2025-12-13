"""
Refactored Multi-NLP Manager using Strategy Pattern.

ARCHITECTURE:
- ProcessorRegistry: Manages processor instances
- ConfigLoader: Loads and validates configurations
- EnsembleVoter: Weighted consensus voting
- StrategyFactory: Creates processing strategies
- LangExtractProcessor: LLM-based primary processor (NEW!)
- MultiNLPManager: Orchestrates everything (< 350 lines)

PROCESSING MODES:
- LLM: LangExtract as primary processor (recommended for quality)
- SINGLE: One NLP processor
- PARALLEL: Multiple processors in parallel
- ENSEMBLE: Weighted voting between processors
- ADAPTIVE: Automatic mode selection

Target: 627 lines → <350 lines (45% reduction)
"""

import asyncio
import logging
import os
from typing import Dict, Any, Optional
from datetime import datetime

from .nlp.strategies import StrategyFactory, ProcessingMode, ProcessingResult
from .nlp.components import ProcessorRegistry, EnsembleVoter, ConfigLoader
from .nlp.adapters import AdvancedParserAdapter
from .settings_manager import settings_manager

logger = logging.getLogger(__name__)


# LangExtract processor (lazy import to avoid circular dependencies)
_langextract_processor = None


def _get_langextract_processor():
    """Lazy initialization of LangExtract processor."""
    global _langextract_processor
    if _langextract_processor is None:
        try:
            from .langextract_processor import get_langextract_processor
            _langextract_processor = get_langextract_processor()
        except ImportError as e:
            logger.warning(f"LangExtract processor not available: {e}")
            _langextract_processor = None
    return _langextract_processor


class MultiNLPManager:
    """
    Refactored Multi-NLP Manager using Strategy Pattern.
    Coordinates multiple NLP processors with intelligent mode selection.
    """

    def __init__(self):
        # Components
        self.config_loader = ConfigLoader(settings_manager)
        self.processor_registry = ProcessorRegistry()
        self.ensemble_voter = EnsembleVoter()

        # Advanced Parser (optional, feature-flagged)
        self.advanced_parser_adapter = None

        # Global settings
        self.processing_mode = ProcessingMode.SINGLE
        self.default_processor = "spacy"
        self.global_config = {}

        # Statistics
        self.processing_statistics = {
            "total_processed": 0,
            "processor_usage": {},
            "average_quality_scores": {},
            "processing_times": {},
            "error_rates": {},
        }

        # Initialization state
        self._initialized = False
        self._init_lock = asyncio.Lock()

    # ========================================================================
    # Backward Compatibility Properties (for old tests)
    # ========================================================================

    @property
    def processors(self):
        """Backward compatibility: access processor_registry.processors."""
        return self.processor_registry.processors

    @processors.setter
    def processors(self, value):
        """Backward compatibility: set processor_registry.processors."""
        self.processor_registry.processors = value

    @property
    def processor_configs(self):
        """Backward compatibility: access processor_registry.processor_configs."""
        return self.processor_registry.processor_configs

    @processor_configs.setter
    def processor_configs(self, value):
        """Backward compatibility: set processor_registry.processor_configs."""
        self.processor_registry.processor_configs = value

    # ========================================================================
    # Feature Flags Support
    # ========================================================================

    def _is_feature_enabled(self, feature_name: str, default: bool = True) -> bool:
        """
        Check if a feature flag is enabled via environment variables.

        Args:
            feature_name: Feature flag name (e.g., "USE_NEW_NLP_ARCHITECTURE")
            default: Default value if env var not set

        Returns:
            True if enabled, False otherwise

        Example:
            >>> if self._is_feature_enabled("USE_ADVANCED_PARSER"):
            ...     # Use advanced parser
        """
        env_value = os.getenv(feature_name)
        if env_value is not None:
            return env_value.lower() in ("true", "1", "yes", "on")
        return default

    async def initialize(self):
        """
        Initialize the Multi-NLP Manager.
        Thread-safe initialization with lock protection.
        """
        async with self._init_lock:
            # Double-check pattern
            if self._initialized:
                logger.info("Multi-NLP Manager already initialized, skipping")
                return

            logger.info("Initializing Multi-NLP Manager...")

            # Load global settings
            self.global_config = await self.config_loader.load_global_settings()
            self.processing_mode = ProcessingMode(
                self.global_config.get("processing_mode", "single")
            )
            self.default_processor = self.global_config.get(
                "default_processor", "spacy"
            )

            # Initialize ensemble voter
            voting_threshold = self.global_config.get("ensemble_voting_threshold", 0.6)
            self.ensemble_voter.set_voting_threshold(voting_threshold)

            # Initialize processor registry
            await self.processor_registry.initialize(self.config_loader)

            # Log feature flags status
            feature_flags_status = {
                "USE_NEW_NLP_ARCHITECTURE": self._is_feature_enabled("USE_NEW_NLP_ARCHITECTURE", True),
                "ENABLE_ENSEMBLE_VOTING": self._is_feature_enabled("ENABLE_ENSEMBLE_VOTING", True),
                "ENABLE_PARALLEL_PROCESSING": self._is_feature_enabled("ENABLE_PARALLEL_PROCESSING", True),
                "USE_ADVANCED_PARSER": self._is_feature_enabled("USE_ADVANCED_PARSER", False),
                "USE_LLM_ENRICHMENT": self._is_feature_enabled("USE_LLM_ENRICHMENT", False),
                "USE_LANGEXTRACT_PRIMARY": self._is_feature_enabled("USE_LANGEXTRACT_PRIMARY", False),
            }
            logger.info(f"Feature flags: {feature_flags_status}")

            # Initialize LangExtract processor if enabled
            if self._is_feature_enabled("USE_LANGEXTRACT_PRIMARY", False):
                langextract = _get_langextract_processor()
                if langextract and langextract.is_available():
                    logger.info("LangExtract processor enabled as primary")
                else:
                    logger.warning(
                        "USE_LANGEXTRACT_PRIMARY enabled but LangExtract not available. "
                        "Set LANGEXTRACT_API_KEY environment variable."
                    )

            # Initialize Advanced Parser if enabled
            if self._is_feature_enabled("USE_ADVANCED_PARSER", False):
                try:
                    enable_enrichment = self._is_feature_enabled("USE_LLM_ENRICHMENT", False)
                    self.advanced_parser_adapter = AdvancedParserAdapter(
                        enable_enrichment=enable_enrichment
                    )
                    logger.info(f"✅ Advanced Parser enabled (enrichment: {enable_enrichment})")
                except Exception as e:
                    logger.warning(f"Failed to initialize Advanced Parser: {e}")
                    self.advanced_parser_adapter = None

            self._initialized = True
            logger.info(
                f"✅ Multi-NLP Manager initialized "
                f"(mode: {self.processing_mode.value}, "
                f"processors: {len(self.processor_registry.processors)}, "
                f"advanced_parser: {self.advanced_parser_adapter is not None})"
            )

    async def extract_descriptions(
        self,
        text: str,
        chapter_id: str = None,
        processor_name: str = None,
        mode: ProcessingMode = None,
        user_id: str = None,  # NEW: для canary deployment (optional)
    ) -> ProcessingResult:
        """
        Extract descriptions from text using specified processing mode.

        Args:
            text: Text to process
            chapter_id: Optional chapter identifier
            processor_name: Optional specific processor to use
            mode: Optional processing mode override
            user_id: Optional user ID for canary deployment cohort assignment

        Returns:
            ProcessingResult with descriptions and metadata

        Note:
            Canary deployment integration point:
            - user_id parameter added for future A/B testing
            - Currently at 100% rollout (all users on new architecture)
            - See nlp_canary.py for gradual rollout management
        """
        start_time = datetime.now()

        # ========================================================================
        # PROCESSING PRIORITY:
        # 1. LangExtract (LLM-based) - if USE_LANGEXTRACT_PRIMARY=true
        # 2. Advanced Parser - if USE_ADVANCED_PARSER=true and text >= 500 chars
        # 3. Standard NLP processors (SpaCy, Natasha, GLiNER, Stanza)
        # ========================================================================

        # PRIORITY 1: LangExtract as primary processor (LLM-based)
        if self._should_use_langextract(text):
            logger.info("Using LangExtract (LLM) for extraction")
            langextract = _get_langextract_processor()

            # Safety check: ensure LangExtract is available before calling
            if langextract is None or not langextract.is_available():
                logger.warning(
                    "LangExtract enabled but not available (missing API key?). "
                    "Falling back to NLP processors or returning empty result."
                )
                # Continue to Advanced Parser or NLP processors if available
                # Otherwise will return empty result at the end
            else:
                result = await langextract.extract_descriptions(text, chapter_id)

                # Update statistics
                self.processing_statistics["total_processed"] += 1
                self.processing_statistics.setdefault("processor_usage", {})
                self.processing_statistics["processor_usage"]["langextract"] = (
                    self.processing_statistics["processor_usage"].get("langextract", 0) + 1
                )

                return result

        # PRIORITY 2: Advanced Parser (feature-flagged)
        if self._should_use_advanced_parser(text):
            logger.info("Using Advanced Parser for extraction")
            result = await self.advanced_parser_adapter.extract_descriptions(text, chapter_id)

            # Update statistics
            self.processing_statistics["total_processed"] += 1
            self.processing_statistics.setdefault("processor_usage", {})
            self.processing_statistics["processor_usage"]["advanced_parser"] = (
                self.processing_statistics["processor_usage"].get("advanced_parser", 0) + 1
            )

            return result

        # Determine processing mode
        processing_mode = mode or self.processing_mode

        # Select processors for this processing
        selected_processors = self._select_processors(
            text, processor_name, processing_mode
        )

        if not selected_processors:
            logger.warning("No processors available for text processing")
            return ProcessingResult(
                descriptions=[],
                processor_results={},
                processing_time=0.0,
                processors_used=[],
                quality_metrics={},
                recommendations=["No NLP processors available"],
            )

        # Build processing config
        config = self._build_processing_config(
            processor_name, selected_processors, processing_mode
        )

        # Get strategy and process
        try:
            strategy = StrategyFactory.get_strategy(processing_mode)
            result = await strategy.process(
                text, chapter_id, self.processor_registry.get_all_processors(), config
            )
        except Exception as e:
            logger.error(f"Processing failed with {processing_mode.value} mode: {e}")
            return ProcessingResult(
                descriptions=[],
                processor_results={},
                processing_time=0.0,
                processors_used=[],
                quality_metrics={},
                recommendations=[f"Processing error: {str(e)}"],
            )

        # Set processing time
        result.processing_time = (datetime.now() - start_time).total_seconds()

        # Update statistics
        self._update_statistics(result)

        logger.info(
            f"Processed text with {processing_mode.value} mode: "
            f"{len(result.descriptions)} descriptions in {result.processing_time:.2f}s"
        )

        return result

    def _should_use_langextract(self, text: str) -> bool:
        """
        Определить, следует ли использовать LangExtract (LLM) как основной процессор.

        LangExtract рекомендуется когда:
        - USE_LANGEXTRACT_PRIMARY=true
        - API ключ доступен
        - Текст достаточной длины (>500 символов)

        Args:
            text: Текст для обработки

        Returns:
            True если следует использовать LangExtract
        """
        # Feature flag check
        if not self._is_feature_enabled("USE_LANGEXTRACT_PRIMARY", False):
            return False

        # Processor availability check
        langextract = _get_langextract_processor()
        if not langextract or not langextract.is_available():
            return False

        # Text length check (LangExtract efficient for longer texts)
        if len(text) < 500:
            logger.debug(
                f"Text too short ({len(text)} chars) for LangExtract, using NLP processors"
            )
            return False

        return True

    def _should_use_advanced_parser(self, text: str) -> bool:
        """
        Определить, следует ли использовать Advanced Parser для этого текста.

        Advanced Parser оптимизирован для:
        - Длинных текстов (>500 символов)
        - Извлечения многопараграфных описаний
        - Качественной фильтрации (5-факторная оценка)

        Args:
            text: Текст для обработки

        Returns:
            True если следует использовать Advanced Parser
        """
        # Feature flag check
        if not self._is_feature_enabled("USE_ADVANCED_PARSER", False):
            return False

        # Adapter availability check
        if not self.advanced_parser_adapter:
            return False

        # Text length check (Advanced Parser optimized for longer texts)
        if len(text) < 500:  # Too short for Advanced Parser benefits
            logger.debug(
                f"Text too short ({len(text)} chars) for Advanced Parser, using standard processors"
            )
            return False

        logger.debug(
            f"Text length {len(text)} chars suitable for Advanced Parser"
        )
        return True

    def _select_processors(
        self, text: str, processor_name: Optional[str], mode: ProcessingMode
    ) -> list[str]:
        """Select processors based on mode and configuration."""
        available_processors = list(self.processor_registry.processors.keys())

        if processor_name and processor_name in available_processors:
            return [processor_name]

        if mode == ProcessingMode.SINGLE:
            return (
                [self.default_processor]
                if self.default_processor in available_processors
                else available_processors[:1]
            )

        elif mode in [
            ProcessingMode.PARALLEL,
            ProcessingMode.SEQUENTIAL,
            ProcessingMode.ENSEMBLE,
        ]:
            max_processors = self.global_config.get("max_parallel_processors", 3)
            return available_processors[:max_processors]

        elif mode == ProcessingMode.ADAPTIVE:
            # Adaptive mode handles its own selection
            return available_processors

        return available_processors[:1]

    def _build_processing_config(
        self,
        processor_name: Optional[str],
        selected_processors: list[str],
        mode: ProcessingMode,
    ) -> Dict[str, Any]:
        """Build configuration for processing strategy."""
        return {
            "processor_name": processor_name,
            "selected_processors": selected_processors,
            "default_processor": self.default_processor,
            "max_parallel_processors": self.global_config.get(
                "max_parallel_processors", 3
            ),
            "ensemble_voting_threshold": self.global_config.get(
                "ensemble_voting_threshold", 0.6
            ),
            "ensemble_voter": (
                self.ensemble_voter if mode == ProcessingMode.ENSEMBLE else None
            ),
        }

    def _update_statistics(self, result: ProcessingResult):
        """Update processing statistics."""
        self.processing_statistics["total_processed"] += 1

        for processor_name in result.processors_used:
            self.processing_statistics["processor_usage"][processor_name] = (
                self.processing_statistics["processor_usage"].get(processor_name, 0) + 1
            )

        for proc_name, quality in result.quality_metrics.items():
            if proc_name not in self.processing_statistics["average_quality_scores"]:
                self.processing_statistics["average_quality_scores"][proc_name] = []
            self.processing_statistics["average_quality_scores"][proc_name].append(
                quality
            )

    async def get_processor_status(self) -> Dict[str, Any]:
        """Get status of all processors and system."""
        status = {
            "processing_mode": self.processing_mode.value,
            "default_processor": self.default_processor,
            "statistics": self.processing_statistics,
            "global_config": self.global_config,
        }

        # Add processor details from registry
        registry_status = self.processor_registry.get_status()
        status.update(registry_status)

        return status

    async def update_processor_config(
        self, processor_name: str, new_config: Dict[str, Any]
    ) -> bool:
        """
        Update processor configuration.

        Args:
            processor_name: Name of the processor
            new_config: New configuration dictionary

        Returns:
            True if update successful
        """
        return await self.processor_registry.update_processor_config(
            processor_name, new_config, settings_manager
        )

    def set_processing_mode(self, mode: ProcessingMode):
        """Set the default processing mode."""
        self.processing_mode = mode
        logger.info(f"Processing mode set to: {mode.value}")

    def set_ensemble_threshold(self, threshold: float):
        """Set ensemble voting threshold."""
        self.ensemble_voter.set_voting_threshold(threshold)
        self.global_config["ensemble_voting_threshold"] = threshold


# Global instance (backward compatibility)
multi_nlp_manager = MultiNLPManager()
