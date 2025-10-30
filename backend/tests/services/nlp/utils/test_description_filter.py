"""
Unit tests for description_filter.py utilities.

Tests all description filtering and prioritization functions:
- filter_and_prioritize_descriptions (main function)
- deduplicate_descriptions
- calculate_priority_score
- apply_literary_boost
- filter_by_quality_threshold
"""

import pytest
from app.services.nlp.utils.description_filter import (
    filter_and_prioritize_descriptions,
    deduplicate_descriptions,
    calculate_priority_score,
    apply_literary_boost,
    filter_by_quality_threshold,
    DEFAULT_MIN_DESCRIPTION_LENGTH,
    DEFAULT_MAX_DESCRIPTION_LENGTH,
    DEFAULT_MIN_WORD_COUNT,
    DEFAULT_CONFIDENCE_THRESHOLD,
)
from app.models.description import DescriptionType


# ============================================================================
# FIXTURES
# ============================================================================


@pytest.fixture
def sample_descriptions():
    """Sample descriptions for testing."""
    return [
        {
            "content": "A dark and mysterious forest with ancient oak trees towering above",
            "type": DescriptionType.LOCATION.value,
            "confidence_score": 0.85,
            "word_count": 11,
        },
        {
            "content": "The brave knight",
            "type": DescriptionType.CHARACTER.value,
            "confidence_score": 0.90,
            "word_count": 3,  # Too few words
        },
        {
            "content": "A beautiful sunset over the mountains with golden rays illuminating the peaks",
            "type": DescriptionType.ATMOSPHERE.value,
            "confidence_score": 0.75,
            "word_count": 12,
        },
        {
            "content": "Sword",
            "type": DescriptionType.OBJECT.value,
            "confidence_score": 0.20,  # Too low confidence
            "word_count": 1,
        },
    ]


@pytest.fixture
def duplicate_descriptions():
    """Descriptions with duplicates for testing deduplication."""
    return [
        {
            "content": "The old castle stood on the hill overlooking the valley below",
            "confidence_score": 0.80,
        },
        {
            "content": "The old castle stood on the hill overlooking the valley below",
            "confidence_score": 0.75,  # Duplicate with lower confidence
        },
        {
            "content": "The old castle stood on the hill with different ending",
            "confidence_score": 0.85,  # Similar start but different
        },
        {
            "content": "A completely different description about the forest",
            "confidence_score": 0.70,
        },
    ]


# ============================================================================
# TESTS: filter_and_prioritize_descriptions (Main Function)
# ============================================================================


class TestFilterAndPrioritizeDescriptions:
    """Test suite for filter_and_prioritize_descriptions function."""

    def test_basic_filtering(self, sample_descriptions):
        """Test basic filtering of descriptions."""
        result = filter_and_prioritize_descriptions(sample_descriptions)

        # Should filter out descriptions that are too short or have low confidence
        assert len(result) < len(sample_descriptions)
        assert all(len(d["content"]) >= DEFAULT_MIN_DESCRIPTION_LENGTH for d in result)
        assert all(d["word_count"] >= DEFAULT_MIN_WORD_COUNT for d in result)

    def test_confidence_threshold_filtering(self, sample_descriptions):
        """Test filtering by confidence threshold."""
        result = filter_and_prioritize_descriptions(
            sample_descriptions, confidence_threshold=0.8
        )

        # Only descriptions with confidence >= 0.8 should pass
        assert all(d["confidence_score"] >= 0.8 for d in result)
        assert len(result) <= 2  # forest (0.85) and knight might be filtered by word count

    def test_custom_min_word_count(self, sample_descriptions):
        """Test custom minimum word count."""
        result = filter_and_prioritize_descriptions(
            sample_descriptions, min_word_count=5
        )

        assert all(d["word_count"] >= 5 for d in result)

    def test_custom_length_limits(self, sample_descriptions):
        """Test custom min/max length limits."""
        result = filter_and_prioritize_descriptions(
            sample_descriptions, min_description_length=60, max_description_length=200
        )

        for desc in result:
            content_len = len(desc["content"])
            assert 60 <= content_len <= 200

    def test_sorting_by_priority(self):
        """Test that results are sorted by priority score (highest first)."""
        descriptions = [
            {
                "content": "Low priority description with enough words and characters",
                "type": DescriptionType.ACTION.value,
                "confidence_score": 0.5,
                "word_count": 10,
            },
            {
                "content": "High priority description with excellent quality and sufficient length",
                "type": DescriptionType.LOCATION.value,
                "confidence_score": 0.9,
                "word_count": 12,
            },
        ]

        result = filter_and_prioritize_descriptions(descriptions)

        # Should be sorted by priority (location with high confidence first)
        if len(result) >= 2:
            assert result[0]["priority_score"] >= result[1]["priority_score"]

    def test_priority_score_calculation(self, sample_descriptions):
        """Test that priority scores are calculated and added."""
        result = filter_and_prioritize_descriptions(sample_descriptions)

        for desc in result:
            assert "priority_score" in desc
            assert isinstance(desc["priority_score"], (int, float))
            assert desc["priority_score"] > 0

    def test_deduplication_enabled(self, duplicate_descriptions):
        """Test that deduplication is enabled by default."""
        result = filter_and_prioritize_descriptions(
            duplicate_descriptions, deduplicate=True
        )

        # Should remove exact duplicates
        contents = [d["content"][:50] for d in result]
        assert len(contents) == len(set(contents))

    def test_deduplication_disabled(self, duplicate_descriptions):
        """Test disabling deduplication."""
        result = filter_and_prioritize_descriptions(
            duplicate_descriptions, deduplicate=False
        )

        # May contain duplicates (depending on other filters)
        # Just verify it doesn't crash and returns results
        assert isinstance(result, list)

    def test_empty_input(self):
        """Test with empty input list."""
        result = filter_and_prioritize_descriptions([])
        assert result == []

    def test_all_filtered_out(self):
        """Test when all descriptions are filtered out."""
        bad_descriptions = [
            {"content": "Short", "confidence_score": 0.1, "word_count": 1},
            {"content": "Also short", "confidence_score": 0.2, "word_count": 2},
        ]

        result = filter_and_prioritize_descriptions(bad_descriptions)
        assert result == []


# ============================================================================
# TESTS: deduplicate_descriptions
# ============================================================================


class TestDeduplicateDescriptions:
    """Test suite for deduplicate_descriptions function."""

    def test_exact_duplicates_removed(self):
        """Test removal of exact duplicates."""
        descriptions = [
            {"content": "The same description"},
            {"content": "The same description"},
            {"content": "Different description"},
        ]

        result = deduplicate_descriptions(descriptions)
        assert len(result) == 2

    def test_similar_start_duplicates(self):
        """Test removal of descriptions with similar starts."""
        descriptions = [
            {"content": "The old castle stood on the hill overlooking valley"},
            {"content": "The old castle stood on the hill with towers"},
            {"content": "Completely different text about forest"},
        ]

        result = deduplicate_descriptions(descriptions, window_size=30)

        # First two should be considered duplicates (same first 30 chars)
        assert len(result) == 2

    def test_custom_window_size(self):
        """Test custom window size for deduplication."""
        descriptions = [
            {"content": "Short" * 20},  # 100 chars
            {"content": "Short" * 20 + " different ending"},  # Same first 100 chars
        ]

        # With window_size=50, should be unique
        result = deduplicate_descriptions(descriptions, window_size=50)
        assert len(result) == 1

        # With window_size=10, might be same
        result = deduplicate_descriptions(descriptions, window_size=10)
        assert len(result) == 1

    def test_case_insensitive_deduplication(self):
        """Test that deduplication is case-insensitive."""
        descriptions = [
            {"content": "The Dark Forest"},
            {"content": "the dark forest"},
            {"content": "THE DARK FOREST"},
        ]

        result = deduplicate_descriptions(descriptions)
        assert len(result) == 1

    def test_whitespace_handling(self):
        """Test that whitespace is stripped during deduplication."""
        descriptions = [
            {"content": "  The forest  "},
            {"content": "The forest"},
            {"content": "\tThe forest\n"},
        ]

        result = deduplicate_descriptions(descriptions)
        assert len(result) == 1

    def test_empty_content(self):
        """Test handling of empty content."""
        descriptions = [
            {"content": ""},
            {"content": ""},
            {"content": "Valid description"},
        ]

        result = deduplicate_descriptions(descriptions)
        # Empty strings should deduplicate to 1, plus the valid one
        assert len(result) == 2

    def test_order_preserved(self):
        """Test that order is preserved (first occurrence kept)."""
        descriptions = [
            {"content": "First", "id": 1},
            {"content": "First", "id": 2},
            {"content": "Second", "id": 3},
        ]

        result = deduplicate_descriptions(descriptions)
        assert len(result) == 2
        assert result[0]["id"] == 1  # First occurrence kept
        assert result[1]["id"] == 3


# ============================================================================
# TESTS: calculate_priority_score
# ============================================================================


class TestCalculatePriorityScore:
    """Test suite for calculate_priority_score function."""

    def test_location_high_priority(self):
        """Test that locations get high priority."""
        score = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=200, word_count=30
        )

        # Location base priority is 75
        assert score > 70

    def test_character_medium_priority(self):
        """Test that characters get medium priority."""
        score = calculate_priority_score(
            DescriptionType.CHARACTER.value,
            confidence=0.8,
            text_length=200,
            word_count=30,
        )

        # Character base priority is 60
        assert 60 <= score <= 100

    def test_action_low_priority(self):
        """Test that actions get lower priority."""
        score_action = calculate_priority_score(
            DescriptionType.ACTION.value, confidence=0.8, text_length=200, word_count=30
        )

        score_location = calculate_priority_score(
            DescriptionType.LOCATION.value,
            confidence=0.8,
            text_length=200,
            word_count=30,
        )

        # Action should have lower priority than location
        assert score_action < score_location

    def test_confidence_bonus(self):
        """Test confidence bonus calculation."""
        score_low = calculate_priority_score(
            DescriptionType.LOCATION.value,
            confidence=0.3,
            text_length=200,
            word_count=30,
        )

        score_high = calculate_priority_score(
            DescriptionType.LOCATION.value,
            confidence=0.9,
            text_length=200,
            word_count=30,
        )

        # Higher confidence should yield higher score
        assert score_high > score_low
        # Difference should be approximately 0.6 * 20 = 12 points
        assert abs((score_high - score_low) - 12) < 1

    def test_optimal_length_bonus(self):
        """Test bonus for optimal text length (50-400 chars)."""
        score_optimal = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=200
        )

        score_short = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=30
        )

        score_long = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=600
        )

        # Optimal length should have highest score
        assert score_optimal > score_short
        assert score_optimal > score_long

    def test_word_count_bonus(self):
        """Test word count bonus calculation."""
        score_optimal = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=200, word_count=30
        )

        score_few = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=200, word_count=5
        )

        score_many = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=200, word_count=100
        )

        # Optimal word count (10-50) should have highest score
        assert score_optimal > score_few
        assert score_optimal >= score_many

    def test_without_word_count(self):
        """Test calculation without word_count parameter."""
        score = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=0.8, text_length=200
        )

        # Should still calculate, just without word count bonus
        assert score > 0

    def test_unknown_type(self):
        """Test with unknown description type."""
        score = calculate_priority_score(
            "unknown_type", confidence=0.8, text_length=200, word_count=30
        )

        # Should use default priority (30)
        assert score >= 30

    def test_score_range(self):
        """Test that scores are in reasonable range."""
        score = calculate_priority_score(
            DescriptionType.LOCATION.value, confidence=1.0, text_length=200, word_count=30
        )

        # Max theoretical score: 75 (base) + 20 (conf) + 10 (len) + 5 (words) = 110
        assert 0 <= score <= 120


# ============================================================================
# TESTS: apply_literary_boost
# ============================================================================


class TestApplyLiteraryBoost:
    """Test suite for apply_literary_boost function."""

    def test_default_boost_factor(self):
        """Test default boost factor of 1.3."""
        descriptions = [{"priority_score": 50.0}, {"priority_score": 100.0}]

        result = apply_literary_boost(descriptions)

        assert result[0]["priority_score"] == 65.0  # 50 * 1.3
        assert result[1]["priority_score"] == 130.0  # 100 * 1.3

    def test_custom_boost_factor(self):
        """Test custom boost factor."""
        descriptions = [{"priority_score": 50.0}]

        result = apply_literary_boost(descriptions, boost_factor=2.0)

        assert result[0]["priority_score"] == 100.0  # 50 * 2.0

    def test_rounding(self):
        """Test that scores are rounded to 2 decimal places."""
        descriptions = [{"priority_score": 33.333}]

        result = apply_literary_boost(descriptions, boost_factor=1.5)

        # 33.333 * 1.5 = 49.9995, should round to 50.0
        assert result[0]["priority_score"] == 50.0

    def test_descriptions_without_score(self):
        """Test handling of descriptions without priority_score."""
        descriptions = [{"content": "No score"}, {"priority_score": 50.0}]

        result = apply_literary_boost(descriptions)

        # First description should remain unchanged
        assert "priority_score" not in result[0]
        # Second should be boosted
        assert result[1]["priority_score"] == 65.0

    def test_empty_list(self):
        """Test with empty list."""
        result = apply_literary_boost([])
        assert result == []

    def test_in_place_modification(self):
        """Test that original list is modified in place."""
        descriptions = [{"priority_score": 50.0}]
        result = apply_literary_boost(descriptions)

        # Should return the same list object
        assert result is descriptions
        assert result[0]["priority_score"] == 65.0


# ============================================================================
# TESTS: filter_by_quality_threshold
# ============================================================================


class TestFilterByQualityThreshold:
    """Test suite for filter_by_quality_threshold function."""

    def test_default_threshold(self):
        """Test default quality threshold of 0.5."""
        descriptions = [
            {"confidence_score": 0.3},
            {"confidence_score": 0.5},
            {"confidence_score": 0.7},
            {"confidence_score": 0.9},
        ]

        result = filter_by_quality_threshold(descriptions)

        # Only >= 0.5 should pass
        assert len(result) == 3
        assert all(d["confidence_score"] >= 0.5 for d in result)

    def test_custom_threshold(self):
        """Test custom quality threshold."""
        descriptions = [
            {"confidence_score": 0.3},
            {"confidence_score": 0.5},
            {"confidence_score": 0.7},
            {"confidence_score": 0.9},
        ]

        result = filter_by_quality_threshold(descriptions, quality_threshold=0.8)

        # Only >= 0.8 should pass
        assert len(result) == 1
        assert result[0]["confidence_score"] == 0.9

    def test_missing_confidence_score(self):
        """Test handling of missing confidence_score."""
        descriptions = [
            {"content": "No score"},
            {"confidence_score": 0.6},
        ]

        result = filter_by_quality_threshold(descriptions, quality_threshold=0.5)

        # Description without score defaults to 0, should be filtered out
        assert len(result) == 1
        assert result[0]["confidence_score"] == 0.6

    def test_edge_case_exact_threshold(self):
        """Test that descriptions exactly at threshold are included."""
        descriptions = [{"confidence_score": 0.5}]

        result = filter_by_quality_threshold(descriptions, quality_threshold=0.5)

        assert len(result) == 1

    def test_empty_list(self):
        """Test with empty list."""
        result = filter_by_quality_threshold([])
        assert result == []

    def test_all_filtered_out(self):
        """Test when all descriptions are below threshold."""
        descriptions = [
            {"confidence_score": 0.1},
            {"confidence_score": 0.2},
            {"confidence_score": 0.3},
        ]

        result = filter_by_quality_threshold(descriptions, quality_threshold=0.9)
        assert result == []


# ============================================================================
# INTEGRATION TESTS
# ============================================================================


class TestIntegration:
    """Integration tests for complete filtering pipeline."""

    def test_complete_filtering_pipeline(self):
        """Test complete filtering pipeline from raw to final."""
        raw_descriptions = [
            {
                "content": "A dark mysterious forest with tall ancient trees and fog",
                "type": DescriptionType.LOCATION.value,
                "confidence_score": 0.85,
                "word_count": 10,
            },
            {
                "content": "A dark mysterious forest with tall ancient trees and fog",
                "type": DescriptionType.LOCATION.value,
                "confidence_score": 0.80,  # Duplicate
                "word_count": 10,
            },
            {
                "content": "The brave knight fought valiantly against overwhelming odds",
                "type": DescriptionType.CHARACTER.value,
                "confidence_score": 0.90,
                "word_count": 10,
            },
            {
                "content": "Sword",
                "type": DescriptionType.OBJECT.value,
                "confidence_score": 0.2,  # Low confidence
                "word_count": 1,
            },
        ]

        # Step 1: Filter and prioritize
        filtered = filter_and_prioritize_descriptions(
            raw_descriptions, confidence_threshold=0.7
        )

        # Should remove duplicate and low confidence
        assert len(filtered) == 2

        # Step 2: Apply literary boost
        boosted = apply_literary_boost(filtered, boost_factor=1.3)

        # Scores should be boosted
        assert all(d["priority_score"] > 70 for d in boosted)

        # Should still be sorted by priority
        if len(boosted) >= 2:
            assert boosted[0]["priority_score"] >= boosted[1]["priority_score"]
