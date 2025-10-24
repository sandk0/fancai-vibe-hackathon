"""
Adaptive processor strategy - intelligently selects best approach.
"""

import logging
from typing import Dict, Any, List
import re

from .base_strategy import ProcessingStrategy, ProcessingResult
from .single_strategy import SingleStrategy
from .parallel_strategy import ParallelStrategy
from .ensemble_strategy import EnsembleStrategy

logger = logging.getLogger(__name__)


class AdaptiveStrategy(ProcessingStrategy):
    """Strategy that adapts processing based on text characteristics."""

    def __init__(self):
        self.single_strategy = SingleStrategy()
        self.parallel_strategy = ParallelStrategy()
        self.ensemble_strategy = EnsembleStrategy()

    async def process(
        self,
        text: str,
        chapter_id: str,
        processors: Dict[str, Any],
        config: Dict[str, Any],
    ) -> ProcessingResult:
        """Adaptively process text based on its characteristics."""
        # Analyze text to select best processors
        selected_processors = self._adaptive_processor_selection(text, processors)

        # Estimate text complexity
        text_complexity = self._estimate_text_complexity(text)

        # Update config with selected processors
        adaptive_config = config.copy()
        adaptive_config["selected_processors"] = selected_processors

        # Choose strategy based on complexity and processor count
        if text_complexity > 0.8 or len(selected_processors) > 2:
            # Complex text - use ensemble for best quality
            logger.info(
                f"Adaptive: Using ENSEMBLE mode (complexity={text_complexity:.2f})"
            )
            result = await self.ensemble_strategy.process(
                text, chapter_id, processors, adaptive_config
            )
            result.recommendations.append(
                f"Adaptive mode selected ENSEMBLE (complexity: {text_complexity:.2f})"
            )
        elif len(selected_processors) == 2:
            # Medium complexity - use parallel
            logger.info(
                f"Adaptive: Using PARALLEL mode (complexity={text_complexity:.2f})"
            )
            result = await self.parallel_strategy.process(
                text, chapter_id, processors, adaptive_config
            )
            result.recommendations.append(
                f"Adaptive mode selected PARALLEL (complexity: {text_complexity:.2f})"
            )
        else:
            # Simple text - single processor is enough
            logger.info(
                f"Adaptive: Using SINGLE mode (complexity={text_complexity:.2f})"
            )
            adaptive_config["processor_name"] = (
                selected_processors[0] if selected_processors else None
            )
            result = await self.single_strategy.process(
                text, chapter_id, processors, adaptive_config
            )
            result.recommendations.append(
                f"Adaptive mode selected SINGLE (complexity: {text_complexity:.2f})"
            )

        return result

    def _adaptive_processor_selection(
        self, text: str, processors: Dict[str, Any]
    ) -> List[str]:
        """Adaptively select processors based on text characteristics."""
        selected = []

        # Analyze text characteristics
        text_length = len(text)
        len(text.split())
        has_names = self._contains_person_names(text)
        self._contains_location_names(text)
        complexity = self._estimate_text_complexity(text)

        # Select processors based on characteristics
        if has_names and "natasha" in processors:
            selected.append("natasha")  # Natasha best for Russian names

        if text_length > 1000 and "spacy" in processors:
            selected.append("spacy")  # SpaCy good for long texts

        if complexity > 0.7 and "stanza" in processors:
            selected.append("stanza")  # Stanza for complex constructions

        # Fallback to default processor if none selected
        if not selected:
            default_processor = (
                "spacy" if "spacy" in processors else list(processors.keys())[0]
            )
            selected.append(default_processor)

        return selected

    def _contains_person_names(self, text: str) -> bool:
        """Check if text contains person names (simple heuristic)."""
        # Simple patterns for Russian names
        name_patterns = [
            r"\b[А-Я][а-я]+(?:ов|ев|ин|ын|ич|на|ия|ья)\b",  # Surnames
            r"\b[А-Я][а-я]{2,}(?:\s+[А-Я][а-я]+)?\b",  # Names
        ]

        for pattern in name_patterns:
            if re.search(pattern, text):
                return True
        return False

    def _contains_location_names(self, text: str) -> bool:
        """Check if text contains location names."""
        location_keywords = [
            "город",
            "село",
            "деревня",
            "столица",
            "область",
            "район",
            "улица",
            "площадь",
        ]
        return any(keyword in text.lower() for keyword in location_keywords)

    def _estimate_text_complexity(self, text: str) -> float:
        """Estimate text complexity for processor selection."""
        # Simple complexity metrics
        sentences = text.count(".") + text.count("!") + text.count("?")
        words = len(text.split())
        avg_word_length = sum(len(word) for word in text.split()) / max(1, words)
        avg_sentence_length = words / max(1, sentences)

        # Normalize metrics
        word_complexity = min(1.0, avg_word_length / 10)  # Words >10 chars are complex
        sentence_complexity = min(
            1.0, avg_sentence_length / 20
        )  # Sentences >20 words are complex

        return (word_complexity + sentence_complexity) / 2
