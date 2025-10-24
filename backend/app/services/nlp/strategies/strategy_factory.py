"""
Factory for creating processing strategies.
"""

import logging
from enum import Enum

from .base_strategy import ProcessingStrategy
from .single_strategy import SingleStrategy
from .parallel_strategy import ParallelStrategy
from .sequential_strategy import SequentialStrategy
from .ensemble_strategy import EnsembleStrategy
from .adaptive_strategy import AdaptiveStrategy

logger = logging.getLogger(__name__)


class ProcessingMode(Enum):
    """Processing modes for NLP."""

    SINGLE = "single"
    PARALLEL = "parallel"
    SEQUENTIAL = "sequential"
    ENSEMBLE = "ensemble"
    ADAPTIVE = "adaptive"


class StrategyFactory:
    """Factory for creating processing strategies based on mode."""

    # Strategy cache for reuse
    _strategy_cache = {}

    @classmethod
    def get_strategy(cls, mode: ProcessingMode) -> ProcessingStrategy:
        """
        Get processing strategy for the given mode.

        Args:
            mode: Processing mode

        Returns:
            ProcessingStrategy instance

        Raises:
            ValueError: If mode is unknown
        """
        # Check cache first
        if mode in cls._strategy_cache:
            return cls._strategy_cache[mode]

        # Create new strategy
        if mode == ProcessingMode.SINGLE:
            strategy = SingleStrategy()
        elif mode == ProcessingMode.PARALLEL:
            strategy = ParallelStrategy()
        elif mode == ProcessingMode.SEQUENTIAL:
            strategy = SequentialStrategy()
        elif mode == ProcessingMode.ENSEMBLE:
            strategy = EnsembleStrategy()
        elif mode == ProcessingMode.ADAPTIVE:
            strategy = AdaptiveStrategy()
        else:
            logger.error(f"Unknown processing mode: {mode}")
            raise ValueError(f"Unknown processing mode: {mode}")

        # Cache and return
        cls._strategy_cache[mode] = strategy
        logger.debug(f"Created strategy for mode: {mode.value}")
        return strategy

    @classmethod
    def clear_cache(cls):
        """Clear the strategy cache."""
        cls._strategy_cache = {}
