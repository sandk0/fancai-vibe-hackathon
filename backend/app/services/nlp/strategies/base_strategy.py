"""
Base Strategy interface for processing modes.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class ProcessingResult:
    """Result of text processing."""

    descriptions: List[Dict[str, Any]]
    processor_results: Dict[str, List[Dict[str, Any]]]
    processing_time: float
    processors_used: List[str]
    quality_metrics: Dict[str, float]
    recommendations: List[str]


class ProcessingStrategy(ABC):
    """Base strategy for processing text with NLP processors."""

    @abstractmethod
    async def process(
        self,
        text: str,
        chapter_id: str,
        processors: Dict[str, Any],
        config: Dict[str, Any],
    ) -> ProcessingResult:
        """
        Process text using the specific strategy.

        Args:
            text: Text to process
            chapter_id: Chapter identifier
            processors: Dictionary of available NLP processors
            config: Configuration dictionary

        Returns:
            ProcessingResult with descriptions and metadata
        """
        pass

    def _combine_descriptions(
        self, descriptions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Combine and deduplicate descriptions."""
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

        # Select best description from each group
        combined = []
        for group_descriptions in grouped.values():
            # Choose description with highest priority_score
            best_desc = max(
                group_descriptions, key=lambda x: x.get("priority_score", 0)
            )

            # Add source information
            sources = list(
                set(desc.get("source", "unknown") for desc in group_descriptions)
            )
            best_desc["sources"] = sources
            best_desc["consensus_strength"] = len(group_descriptions)

            combined.append(best_desc)

        # Sort by priority
        combined.sort(key=lambda x: x.get("priority_score", 0), reverse=True)

        return combined

    def _generate_recommendations(
        self, quality_metrics: Dict[str, float], processors_used: List[str]
    ) -> List[str]:
        """Generate recommendations for improving processing."""
        recommendations = []

        avg_quality = sum(quality_metrics.values()) / max(1, len(quality_metrics))

        if avg_quality < 0.3:
            recommendations.append(
                "Low quality results. Consider adjusting confidence thresholds."
            )

        if len(processors_used) == 1:
            recommendations.append(
                "Consider using multiple processors for better coverage."
            )

        # Processor recommendations
        best_processor = max(
            quality_metrics.items(), key=lambda x: x[1], default=(None, 0)
        )
        if best_processor[1] > 0.7:
            recommendations.append(
                f"Processor {best_processor[0]} showed excellent results."
            )

        return recommendations
