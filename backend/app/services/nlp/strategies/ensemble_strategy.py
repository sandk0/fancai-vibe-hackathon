"""
Ensemble processor strategy - combines results with weighted voting.
"""

import logging
from typing import Dict, Any, List

from .parallel_strategy import ParallelStrategy
from .base_strategy import ProcessingResult

logger = logging.getLogger(__name__)


class EnsembleStrategy(ParallelStrategy):
    """Strategy for processing with ensemble voting from multiple processors."""

    async def process(
        self,
        text: str,
        chapter_id: str,
        processors: Dict[str, Any],
        config: Dict[str, Any],
    ) -> ProcessingResult:
        """Process text using ensemble voting approach."""
        # First, run parallel processing
        parallel_result = await super().process(text, chapter_id, processors, config)

        # Apply ensemble voting
        ensemble_voter = config.get("ensemble_voter")
        if ensemble_voter:
            ensemble_descriptions = ensemble_voter.vote(
                parallel_result.processor_results, processors
            )
        else:
            # Fallback to simple voting if no voter provided
            ensemble_descriptions = self._simple_ensemble_voting(
                parallel_result.processor_results, config
            )

        return ProcessingResult(
            descriptions=ensemble_descriptions,
            processor_results=parallel_result.processor_results,
            processing_time=parallel_result.processing_time,
            processors_used=parallel_result.processors_used,
            quality_metrics=parallel_result.quality_metrics,
            recommendations=parallel_result.recommendations
            + ["Used ensemble voting for improved accuracy"],
        )

    def _simple_ensemble_voting(
        self, processor_results: Dict[str, List[Dict[str, Any]]], config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Simple ensemble voting fallback."""
        if not processor_results:
            return []

        # Collect all descriptions
        all_descriptions = []
        for descriptions in processor_results.values():
            all_descriptions.extend(descriptions)

        # Combine with deduplication
        combined = self._combine_descriptions(all_descriptions)

        # Filter by consensus threshold
        voting_threshold = config.get("ensemble_voting_threshold", 0.6)
        num_processors = len(processor_results)

        filtered_descriptions = []
        for desc in combined:
            consensus = desc.get("consensus_strength", 0) / max(1, num_processors)
            if consensus >= voting_threshold:
                # Boost priority for high consensus
                desc["priority_score"] *= 1.0 + consensus * 0.5
                filtered_descriptions.append(desc)

        return filtered_descriptions
