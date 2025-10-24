"""
Ensemble Voter - weighted consensus algorithm for combining processor results.
"""

import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class EnsembleVoter:
    """
    Ensemble voting system for combining results from multiple NLP processors.
    Uses weighted consensus with configurable thresholds.
    """

    def __init__(self, voting_threshold: float = 0.6):
        """
        Initialize ensemble voter.

        Args:
            voting_threshold: Minimum consensus ratio (0.0-1.0) to include a description
        """
        self.voting_threshold = voting_threshold

    def vote(
        self,
        processor_results: Dict[str, List[Dict[str, Any]]],
        processors: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Apply weighted consensus voting to processor results.

        Args:
            processor_results: Results from each processor
            processors: Processor instances (for weights)

        Returns:
            Filtered and weighted descriptions
        """
        if not processor_results:
            return []

        # Collect all descriptions
        all_descriptions = []
        for processor_name, descriptions in processor_results.items():
            for desc in descriptions:
                # Add processor weight information
                processor = processors.get(processor_name)
                if processor and hasattr(processor, "config"):
                    desc["processor_weight"] = processor.config.weight
                else:
                    desc["processor_weight"] = 1.0
                all_descriptions.append(desc)

        # Combine and deduplicate
        combined = self._combine_with_weights(all_descriptions)

        # Apply consensus filtering
        filtered = self._filter_by_consensus(combined, len(processor_results))

        # Enrich with context
        enriched = self._enrich_context(filtered)

        return enriched

    def _combine_with_weights(
        self, descriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Combine descriptions with processor weights."""
        if not descriptions:
            return []

        # Group similar descriptions
        grouped = {}

        for desc in descriptions:
            # Create key based on content and type
            content_key = (desc["content"][:100], desc["type"])

            if content_key not in grouped:
                grouped[content_key] = []
            grouped[content_key].append(desc)

        # Select best from each group with weighted consensus
        combined = []
        for group_descriptions in grouped.values():
            # Calculate weighted score for each description
            for desc in group_descriptions:
                processor_weight = desc.get("processor_weight", 1.0)
                base_priority = desc.get("priority_score", 0.5)
                desc["weighted_score"] = base_priority * processor_weight

            # Select description with highest weighted score
            best_desc = max(
                group_descriptions, key=lambda x: x.get("weighted_score", 0)
            )

            # Calculate consensus metrics
            sources = list(
                set(desc.get("source", "unknown") for desc in group_descriptions)
            )
            total_weight = sum(
                desc.get("processor_weight", 1.0) for desc in group_descriptions
            )
            max_possible_weight = sum(
                max(
                    (d.get("processor_weight", 1.0) for d in group_descriptions),
                    default=1.0,
                )
                for _ in range(len(set(sources)))
            )

            best_desc["sources"] = sources
            best_desc["consensus_count"] = len(group_descriptions)
            best_desc["consensus_weight"] = total_weight
            best_desc["consensus_ratio"] = total_weight / max(1.0, max_possible_weight)

            combined.append(best_desc)

        # Sort by weighted score
        combined.sort(key=lambda x: x.get("weighted_score", 0), reverse=True)

        return combined

    def _filter_by_consensus(
        self, descriptions: List[Dict[str, Any]], num_processors: int
    ) -> List[Dict[str, Any]]:
        """Filter descriptions by consensus threshold."""
        filtered = []

        for desc in descriptions:
            consensus_ratio = desc.get("consensus_ratio", 0)
            consensus_count = desc.get("consensus_count", 0)

            # Check if meets threshold
            if consensus_ratio >= self.voting_threshold:
                # Boost priority for high consensus
                consensus_boost = 1.0 + (consensus_ratio * 0.5)
                desc["priority_score"] = (
                    desc.get("priority_score", 0.5) * consensus_boost
                )
                desc["ensemble_boosted"] = True
                filtered.append(desc)
            elif consensus_count >= 2:
                # Include if at least 2 processors agreed, even if below threshold
                logger.debug(
                    f"Including description with {consensus_count} agreements "
                    f"(ratio: {consensus_ratio:.2f}, threshold: {self.voting_threshold})"
                )
                desc["ensemble_boosted"] = False
                filtered.append(desc)

        logger.info(
            f"Ensemble voting: {len(descriptions)} → {len(filtered)} descriptions "
            f"(threshold: {self.voting_threshold})"
        )

        return filtered

    def _enrich_context(
        self, descriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Enrich descriptions with additional context."""
        for desc in descriptions:
            # Add ensemble metadata
            desc["processing_method"] = "ensemble"

            # Add quality indicators
            consensus_ratio = desc.get("consensus_ratio", 0)
            if consensus_ratio >= 0.8:
                desc["quality_indicator"] = "high"
            elif consensus_ratio >= 0.6:
                desc["quality_indicator"] = "medium"
            else:
                desc["quality_indicator"] = "low"

            # Clean up temporary fields
            if "processor_weight" in desc:
                del desc["processor_weight"]
            if "weighted_score" in desc:
                del desc["weighted_score"]

        return descriptions

    def set_voting_threshold(self, threshold: float):
        """Update voting threshold."""
        if 0.0 <= threshold <= 1.0:
            self.voting_threshold = threshold
            logger.info(f"Updated ensemble voting threshold to {threshold}")
        else:
            logger.warning(f"Invalid threshold {threshold}, must be 0.0-1.0")
