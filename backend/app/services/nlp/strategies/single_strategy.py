"""
Single processor strategy - uses only one NLP processor.
"""

import logging
from typing import Dict, Any

from .base_strategy import ProcessingStrategy, ProcessingResult

logger = logging.getLogger(__name__)


class SingleStrategy(ProcessingStrategy):
    """Strategy for processing with a single NLP processor."""

    async def process(
        self,
        text: str,
        chapter_id: str,
        processors: Dict[str, Any],
        config: Dict[str, Any],
    ) -> ProcessingResult:
        """Process text using a single processor."""
        # Select processor
        processor_name = config.get("processor_name") or config.get(
            "default_processor", "spacy"
        )

        if processor_name not in processors:
            # Fallback to first available
            processor_name = list(processors.keys())[0] if processors else None

        if not processor_name:
            logger.warning("No processors available for SINGLE mode")
            return ProcessingResult(
                descriptions=[],
                processor_results={},
                processing_time=0.0,
                processors_used=[],
                quality_metrics={},
                recommendations=["No NLP processors available"],
            )

        # Process with single processor
        processor = processors[processor_name]
        descriptions = await processor.extract_descriptions(text, chapter_id)

        quality_metrics = {
            processor_name: processor._calculate_quality_score(descriptions)
        }

        return ProcessingResult(
            descriptions=descriptions,
            processor_results={processor_name: descriptions},
            processing_time=0.0,  # Will be set by manager
            processors_used=[processor_name],
            quality_metrics=quality_metrics,
            recommendations=self._generate_recommendations(
                quality_metrics, [processor_name]
            ),
        )
