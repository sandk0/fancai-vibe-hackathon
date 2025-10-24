"""
Component modules for Multi-NLP system.
"""

from .processor_registry import ProcessorRegistry
from .ensemble_voter import EnsembleVoter
from .config_loader import ConfigLoader

__all__ = ["ProcessorRegistry", "EnsembleVoter", "ConfigLoader"]
