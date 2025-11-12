"""
Shared utilities for NLP processors.
Extracted from duplicated code to improve maintainability.
"""

from .text_cleaner import clean_text
from .description_filter import (
    filter_and_prioritize_descriptions,
    calculate_priority_score,
    deduplicate_descriptions,
    filter_by_quality_threshold,
)
from .type_mapper import map_entity_to_description_type, EntityType
from .quality_scorer import (
    calculate_quality_score,
    calculate_descriptive_score,
    calculate_ner_confidence,
    calculate_dependency_confidence,
    calculate_morphological_descriptiveness,
)
from .text_analysis import (
    contains_person_names,
    contains_location_names,
    estimate_text_complexity,
    extract_capitalized_words,
    count_descriptive_words,
    is_dialogue_text,
    extract_sentence_subjects,
    RUSSIAN_FIRST_NAMES,
    LOCATION_KEYWORDS,
)

__all__ = [
    # text_cleaner
    "clean_text",
    # description_filter
    "filter_and_prioritize_descriptions",
    "calculate_priority_score",
    "deduplicate_descriptions",
    "filter_by_quality_threshold",
    # type_mapper
    "map_entity_to_description_type",
    "EntityType",
    # quality_scorer
    "calculate_quality_score",
    "calculate_descriptive_score",
    "calculate_ner_confidence",
    "calculate_dependency_confidence",
    "calculate_morphological_descriptiveness",
    # text_analysis
    "contains_person_names",
    "contains_location_names",
    "estimate_text_complexity",
    "extract_capitalized_words",
    "count_descriptive_words",
    "is_dialogue_text",
    "extract_sentence_subjects",
    "RUSSIAN_FIRST_NAMES",
    "LOCATION_KEYWORDS",
]
