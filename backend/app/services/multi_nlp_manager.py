"""
Refactored Multi-NLP Manager using Strategy Pattern.

ARCHITECTURE:
- ProcessorRegistry: Manages processor instances
- ConfigLoader: Loads and validates configurations
- EnsembleVoter: Weighted consensus voting
- StrategyFactory: Creates processing strategies
- MultiNLPManager: Orchestrates everything (< 300 lines)

Target: 627 lines → <300 lines (52% reduction)
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from .nlp.strategies import StrategyFactory, ProcessingMode, ProcessingResult
from .nlp.components import ProcessorRegistry, EnsembleVoter, ConfigLoader
from .settings_manager import settings_manager

logger = logging.getLogger(__name__)


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

            self._initialized = True
            logger.info(
                f"✅ Multi-NLP Manager initialized "
                f"(mode: {self.processing_mode.value}, "
                f"processors: {len(self.processor_registry.processors)})"
            )

    async def extract_descriptions(
        self,
        text: str,
        chapter_id: str = None,
        processor_name: str = None,
        mode: ProcessingMode = None,
    ) -> ProcessingResult:
        """
        Extract descriptions from text using specified processing mode.

        Args:
            text: Text to process
            chapter_id: Optional chapter identifier
            processor_name: Optional specific processor to use
            mode: Optional processing mode override

        Returns:
            ProcessingResult with descriptions and metadata
        """
        start_time = datetime.now()

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
