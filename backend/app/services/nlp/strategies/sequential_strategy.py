"""
Sequential processor strategy - runs processors one after another.
"""

import logging
from typing import Dict, Any

from .base_strategy import ProcessingStrategy, ProcessingResult

logger = logging.getLogger(__name__)


class SequentialStrategy(ProcessingStrategy):
    """Strategy for processing with multiple processors sequentially."""

    async def process(
        self,
        text: str,
        chapter_id: str,
        processors: Dict[str, Any],
        config: Dict[str, Any],
    ) -> ProcessingResult:
        """Process text using multiple processors sequentially."""
        # Select processors to use
        processor_names = config.get("selected_processors") or list(processors.keys())
        max_processors = config.get("max_parallel_processors", 3)
        processor_names = processor_names[:max_processors]

        if not processor_names:
            logger.warning("No processors available for SEQUENTIAL mode")
            return ProcessingResult(
                descriptions=[],
                processor_results={},
                processing_time=0.0,
                processors_used=[],
                quality_metrics={},
                recommendations=["No NLP processors available"],
            )

        processor_results = {}
        quality_metrics = {}
        all_descriptions = []

        # Process sequentially
        for name in processor_names:
            if name in processors:
                try:
                    descriptions = await processors[name].extract_descriptions(
                        text, chapter_id
                    )
                    processor_results[name] = descriptions
                    quality_metrics[name] = processors[name]._calculate_quality_score(
                        descriptions
                    )
                    all_descriptions.extend(descriptions)
                except Exception as e:
                    logger.error(f"Error in {name} processor: {e}")
                    processor_results[name] = []
                    quality_metrics[name] = 0.0

        # Combine and deduplicate results
        combined_descriptions = self._combine_descriptions(all_descriptions)

        return ProcessingResult(
            descriptions=combined_descriptions,
            processor_results=processor_results,
            processing_time=0.0,
            processors_used=processor_names,
            quality_metrics=quality_metrics,
            recommendations=self._generate_recommendations(
                quality_metrics, processor_names
            ),
        )
