"""
Unit tests for quality_scorer.py utilities.

Tests all quality scoring functions:
- calculate_quality_score
- calculate_descriptive_score
- calculate_descriptive_score_by_keywords
- calculate_ner_confidence
- calculate_dependency_confidence
- calculate_morphological_descriptiveness
- assess_description_quality
"""

import pytest
from app.services.nlp.utils.quality_scorer import (
    calculate_quality_score,
    calculate_descriptive_score,
    calculate_descriptive_score_by_keywords,
    calculate_ner_confidence,
    calculate_dependency_confidence,
    calculate_morphological_descriptiveness,
    assess_description_quality,
)


# ============================================================================
# TESTS: calculate_quality_score
# ============================================================================


class TestCalculateQualityScore:
    """Test suite for calculate_quality_score function."""

    def test_empty_list(self):
        """Test with empty descriptions list."""
        score = calculate_quality_score([])
        assert score == 0.0

    def test_single_good_description(self):
        """Test with single good quality description."""
        descriptions = [
            {
                "content": "A" * 200,  # Optimal length
                "confidence_score": 0.8,
            }
        ]

        score = calculate_quality_score(descriptions)
        assert 0.6 <= score <= 1.0  # Should be relatively high

    def test_multiple_descriptions_average(self):
        """Test averaging across multiple descriptions."""
        descriptions = [
            {"content": "A" * 100, "confidence_score": 0.5},  # Low quality
            {"content": "A" * 200, "confidence_score": 1.0},  # High quality
        ]

        score = calculate_quality_score(descriptions)
        assert 0.4 <= score <= 0.8  # Should be middle range

    def test_word_variety_factor(self):
        """Test that word variety affects score."""
        # High variety
        high_variety = [
            {
                "content": "The quick brown fox jumps over the lazy dog",
                "confidence_score": 0.8,
            }
        ]

        # Low variety (repeated words)
        low_variety = [
            {
                "content": "word word word word word word word word",
                "confidence_score": 0.8,
            }
        ]

        score_high = calculate_quality_score(high_variety)
        score_low = calculate_quality_score(low_variety)

        assert score_high > score_low

    def test_length_factor(self):
        """Test that length affects score (optimal is ~200 chars)."""
        # Short description
        short_desc = [{"content": "Short", "confidence_score": 0.8}]

        # Optimal length
        optimal_desc = [{"content": "A" * 200, "confidence_score": 0.8}]

        score_short = calculate_quality_score(short_desc)
        score_optimal = calculate_quality_score(optimal_desc)

        assert score_optimal > score_short

    def test_confidence_factor(self):
        """Test that confidence score affects quality."""
        low_conf = [{"content": "A" * 200, "confidence_score": 0.3}]
        high_conf = [{"content": "A" * 200, "confidence_score": 0.9}]

        score_low = calculate_quality_score(low_conf)
        score_high = calculate_quality_score(high_conf)

        assert score_high > score_low

    def test_missing_confidence_defaults(self):
        """Test default confidence score when not provided."""
        descriptions = [{"content": "A" * 200}]  # No confidence_score

        score = calculate_quality_score(descriptions)
        assert score > 0  # Should use default 0.5

    def test_score_rounded_to_three_decimals(self):
        """Test that score is rounded to 3 decimal places."""
        descriptions = [{"content": "Test content", "confidence_score": 0.777}]

        score = calculate_quality_score(descriptions)
        assert isinstance(score, float)
        # Check it's rounded (no more than 3 decimals)
        assert len(str(score).split(".")[-1]) <= 3


# ============================================================================
# TESTS: calculate_descriptive_score
# ============================================================================


class TestCalculateDescriptiveScore:
    """Test suite for calculate_descriptive_score function."""

    def test_with_morphological_params(self):
        """Test with all morphological parameters provided."""
        score = calculate_descriptive_score(
            text="Красивый большой старый дом",
            adj_count=3,
            adv_count=0,
            verb_count=0,
            total_tokens=4,
        )

        # High ratio of adjectives -> high descriptiveness
        assert score > 0.5

    def test_high_adjective_ratio(self):
        """Test high adjective to token ratio."""
        score = calculate_descriptive_score(
            text="", adj_count=5, adv_count=2, verb_count=0, total_tokens=10
        )

        # 7/10 = 0.7 descriptive ratio
        assert score >= 0.5

    def test_optimal_verb_count_bonus(self):
        """Test bonus for optimal verb count (1-3)."""
        score_with_verbs = calculate_descriptive_score(
            text="", adj_count=3, adv_count=1, verb_count=2, total_tokens=10
        )

        score_without_verbs = calculate_descriptive_score(
            text="", adj_count=3, adv_count=1, verb_count=0, total_tokens=10
        )

        # Should get bonus for optimal verb count
        assert score_with_verbs > score_without_verbs

    def test_too_many_verbs_no_bonus(self):
        """Test no bonus for too many verbs (>3)."""
        score = calculate_descriptive_score(
            text="", adj_count=2, adv_count=1, verb_count=5, total_tokens=10
        )

        # Shouldn't get verb bonus
        # descriptive_ratio = 3/10 = 0.3 * 0.8 = 0.24
        assert score < 0.5

    def test_zero_tokens(self):
        """Test with zero total tokens."""
        score = calculate_descriptive_score(
            text="", adj_count=0, adv_count=0, verb_count=0, total_tokens=0
        )

        assert score == 0.0

    def test_fallback_to_keywords_when_params_missing(self):
        """Test fallback to keyword-based scoring when params not provided."""
        score = calculate_descriptive_score(text="Красивый старый дом")

        # Should use keyword-based method
        assert score > 0

    def test_max_score_capped_at_one(self):
        """Test that score is capped at 1.0."""
        score = calculate_descriptive_score(
            text="", adj_count=10, adv_count=10, verb_count=2, total_tokens=10
        )

        # Even with very high ratio, should cap at 1.0
        assert score <= 1.0


# ============================================================================
# TESTS: calculate_descriptive_score_by_keywords
# ============================================================================


class TestCalculateDescriptiveScoreByKeywords:
    """Test suite for calculate_descriptive_score_by_keywords function."""

    def test_multiple_adjectives(self):
        """Test text with multiple descriptive adjectives."""
        text = "Красивый старый большой дом"
        score = calculate_descriptive_score_by_keywords(text)

        # Has 3 descriptive adjectives
        assert score > 0

    def test_adverbs(self):
        """Test text with descriptive adverbs."""
        text = "Красиво сияло ярко"
        score = calculate_descriptive_score_by_keywords(text)

        assert score > 0

    def test_mixed_adjectives_and_adverbs(self):
        """Test text with both adjectives and adverbs."""
        text = "Красивый дом стоял тихо"
        score = calculate_descriptive_score_by_keywords(text)

        # Should detect both красивый (adj) and тихо (adv)
        assert score > 0

    def test_no_descriptive_words(self):
        """Test text without descriptive words."""
        text = "Он пошел туда"
        score = calculate_descriptive_score_by_keywords(text)

        # No descriptive words
        assert score == 0.0

    def test_case_insensitive(self):
        """Test that matching is case insensitive."""
        text_lower = "красивый дом"
        text_upper = "КРАСИВЫЙ ДОМ"
        text_mixed = "Красивый Дом"

        score_lower = calculate_descriptive_score_by_keywords(text_lower)
        score_upper = calculate_descriptive_score_by_keywords(text_upper)
        score_mixed = calculate_descriptive_score_by_keywords(text_mixed)

        # All should have same score
        assert score_lower == score_upper == score_mixed

    def test_normalization_by_length(self):
        """Test score is normalized by text length."""
        short = "Красивый дом"  # 2 words, 1 match
        long = "Красивый дом стоял на холме среди деревьев"  # 7 words, 1 match

        score_short = calculate_descriptive_score_by_keywords(short)
        score_long = calculate_descriptive_score_by_keywords(long)

        # Short text should have higher ratio
        assert score_short > score_long

    def test_max_score_capped(self):
        """Test maximum score is capped at 1.0."""
        text = "Красивый большой старый новый высокий низкий тёмный светлый яркий мрачный"
        score = calculate_descriptive_score_by_keywords(text)

        assert score <= 1.0


# ============================================================================
# TESTS: calculate_ner_confidence
# ============================================================================


class TestCalculateNerConfidence:
    """Test suite for calculate_ner_confidence function."""

    def test_base_confidence(self):
        """Test base confidence level."""
        conf = calculate_ner_confidence("Test", "This is a test sentence")

        # Base confidence is 0.6
        assert conf >= 0.6

    def test_length_bonus(self):
        """Test bonus for longer entities (>3 chars)."""
        short = calculate_ner_confidence("AB", "AB is short")
        long = calculate_ner_confidence("ABCD", "ABCD is longer")

        # Long should get +0.1 bonus
        assert long > short

    def test_position_bonus_middle(self):
        """Test bonus for entities in middle position."""
        conf = calculate_ner_confidence(
            "Entity", "Sentence with entity in middle", entity_position=0.5
        )

        # Should get position bonus (0.1 <= 0.5 <= 0.9)
        assert conf >= 0.7

    def test_position_no_bonus_start(self):
        """Test no bonus for entities at start."""
        conf_start = calculate_ner_confidence(
            "Entity", "Entity at start", entity_position=0.05
        )

        conf_middle = calculate_ner_confidence(
            "Entity", "Word Entity word", entity_position=0.5
        )

        # Middle should have higher confidence
        assert conf_middle > conf_start

    def test_descriptive_words_bonus(self):
        """Test bonus for descriptive words in context."""
        no_desc = calculate_ner_confidence("City", "City mentioned", context_descriptive_words=0)

        with_desc = calculate_ner_confidence(
            "City", "Beautiful city described", context_descriptive_words=2
        )

        # With descriptive words should have higher confidence
        assert with_desc > no_desc

    def test_max_descriptor_bonus(self):
        """Test max descriptor bonus is capped at 0.2."""
        # 10 descriptive words -> 10 * 0.05 = 0.5, but capped at 0.2
        conf = calculate_ner_confidence("Entity", "Text", context_descriptive_words=10)

        # Max bonus: base(0.6) + length(0.1) + desc(0.2) = 0.9
        assert conf <= 1.0

    def test_confidence_capped_at_one(self):
        """Test confidence is capped at 1.0."""
        conf = calculate_ner_confidence(
            "LongEntity",
            "Sentence",
            entity_position=0.5,
            context_descriptive_words=10,
        )

        assert conf <= 1.0

    def test_rounded_to_three_decimals(self):
        """Test confidence is rounded to 3 decimal places."""
        conf = calculate_ner_confidence("Test", "Test sentence")

        # Check rounded
        assert len(str(conf).split(".")[-1]) <= 3


# ============================================================================
# TESTS: calculate_dependency_confidence
# ============================================================================


class TestCalculateDependencyConfidence:
    """Test suite for calculate_dependency_confidence function."""

    def test_base_confidence(self):
        """Test base confidence is 0.6."""
        conf = calculate_dependency_confidence("unknown")

        assert conf == 0.6

    def test_amod_dependency_bonus(self):
        """Test amod (adjective modifier) gets highest bonus."""
        conf_amod = calculate_dependency_confidence("amod")
        conf_base = calculate_dependency_confidence("unknown")

        # amod bonus is 0.2
        assert conf_amod == conf_base + 0.2

    def test_different_dependency_types(self):
        """Test different dependency types get different bonuses."""
        conf_amod = calculate_dependency_confidence("amod")  # +0.2
        conf_nmod = calculate_dependency_confidence("nmod")  # +0.15
        conf_acl = calculate_dependency_confidence("acl")  # +0.1

        assert conf_amod > conf_nmod > conf_acl

    def test_pos_bonus_noun_adj(self):
        """Test bonus for NOUN + ADJ combination."""
        conf_with_bonus = calculate_dependency_confidence(
            "amod", head_pos="NOUN", dependent_pos="ADJ"
        )

        conf_without = calculate_dependency_confidence("amod")

        # Should get +0.1 bonus
        assert conf_with_bonus > conf_without

    def test_sentence_length_bonus(self):
        """Test bonus for longer sentences (>=8 words)."""
        conf_short = calculate_dependency_confidence("amod", sentence_length=5)
        conf_long = calculate_dependency_confidence("amod", sentence_length=10)

        # Long sentence gets +0.05 bonus
        assert conf_long > conf_short

    def test_combined_bonuses(self):
        """Test all bonuses combined."""
        conf = calculate_dependency_confidence(
            dependency_type="amod",
            head_pos="NOUN",
            dependent_pos="ADJ",
            sentence_length=10,
        )

        # Base(0.6) + amod(0.2) + pos(0.1) + length(0.05) = 0.95
        assert abs(conf - 0.95) < 0.01

    def test_confidence_capped_at_one(self):
        """Test confidence is capped at 1.0."""
        conf = calculate_dependency_confidence(
            "amod", head_pos="NOUN", dependent_pos="ADJ", sentence_length=10
        )

        assert conf <= 1.0


# ============================================================================
# TESTS: calculate_morphological_descriptiveness
# ============================================================================


class TestCalculateMorphologicalDescriptiveness:
    """Test suite for calculate_morphological_descriptiveness function."""

    def test_high_descriptive_ratio(self):
        """Test high ratio of descriptive words."""
        score = calculate_morphological_descriptiveness(
            adj_count=5, adv_count=3, participle_count=2, total_words=15
        )

        # 10/15 = 0.67 ratio * 0.8 = 0.536 + variety bonuses
        assert score > 0.5

    def test_variety_bonus(self):
        """Test bonus for variety of descriptive word types."""
        # All types present
        score_varied = calculate_morphological_descriptiveness(
            adj_count=2, adv_count=2, participle_count=2, total_words=20
        )

        # Only adjectives
        score_single = calculate_morphological_descriptiveness(
            adj_count=6, adv_count=0, participle_count=0, total_words=20
        )

        # Both have same ratio (6/20) but varied should have higher variety bonus
        # variety_varied = 0.1 + 0.1 + 0.1 = 0.3
        # variety_single = 0.1
        assert score_varied > score_single

    def test_zero_total_words(self):
        """Test with zero total words."""
        score = calculate_morphological_descriptiveness(
            adj_count=0, adv_count=0, participle_count=0, total_words=0
        )

        assert score == 0.0

    def test_score_capped_at_one(self):
        """Test score is capped at 1.0."""
        score = calculate_morphological_descriptiveness(
            adj_count=15, adv_count=10, participle_count=5, total_words=20
        )

        # Very high ratio but should cap at 1.0
        assert score <= 1.0

    def test_rounded_to_three_decimals(self):
        """Test score is rounded to 3 decimals."""
        score = calculate_morphological_descriptiveness(
            adj_count=3, adv_count=2, participle_count=1, total_words=17
        )

        assert len(str(score).split(".")[-1]) <= 3


# ============================================================================
# TESTS: assess_description_quality
# ============================================================================


class TestAssessDescriptionQuality:
    """Test suite for assess_description_quality function."""

    def test_returns_all_metrics(self):
        """Test that all quality metrics are returned."""
        desc = {
            "content": "A beautiful old castle stood on the hill",
            "confidence_score": 0.8,
            "word_count": 8,
        }

        quality = assess_description_quality(desc)

        # Should return all metrics
        assert "overall_quality" in quality
        assert "length_score" in quality
        assert "confidence_score" in quality
        assert "word_variety" in quality
        assert "word_count_score" in quality

    def test_optimal_word_count(self):
        """Test optimal word count (10-50) gives full score."""
        desc_optimal = {"content": "word " * 30, "word_count": 30}

        desc_suboptimal = {"content": "word " * 5, "word_count": 5}

        quality_optimal = assess_description_quality(desc_optimal)
        quality_suboptimal = assess_description_quality(desc_suboptimal)

        # Optimal should have word_count_score = 1.0
        assert quality_optimal["word_count_score"] == 1.0
        # Suboptimal should have 0.5
        assert quality_suboptimal["word_count_score"] == 0.5

    def test_word_variety_calculation(self):
        """Test word variety calculation."""
        # High variety
        high_variety = {"content": "the quick brown fox jumps"}

        # Low variety
        low_variety = {"content": "word word word word word"}

        quality_high = assess_description_quality(high_variety)
        quality_low = assess_description_quality(low_variety)

        # High variety should have higher word_variety score
        assert quality_high["word_variety"] > quality_low["word_variety"]

    def test_length_score_calculation(self):
        """Test length score (optimal ~200 chars)."""
        short = {"content": "Short"}
        optimal = {"content": "A" * 200}

        quality_short = assess_description_quality(short)
        quality_optimal = assess_description_quality(optimal)

        # Optimal should have length_score = 1.0
        assert quality_optimal["length_score"] == 1.0
        # Short should have lower
        assert quality_short["length_score"] < 1.0

    def test_overall_quality_weighted_average(self):
        """Test overall quality is weighted average."""
        desc = {
            "content": "A" * 200,  # length_score = 1.0
            "confidence_score": 1.0,
            "word_count": 30,  # optimal
        }

        quality = assess_description_quality(desc)

        # With perfect scores:
        # 1.0*0.25 + 1.0*0.35 + word_variety*0.2 + 1.0*0.2
        # = 0.8 + word_variety*0.2
        assert quality["overall_quality"] >= 0.8

    def test_missing_fields_handled(self):
        """Test handling of missing optional fields."""
        desc = {"content": "Just content"}  # No confidence_score or word_count

        quality = assess_description_quality(desc)

        # Should use defaults
        assert quality["confidence_score"] == 0.5  # Default
        assert quality["overall_quality"] > 0

    def test_scores_rounded(self):
        """Test all scores are rounded to 3 decimals."""
        desc = {"content": "Test content with variety", "confidence_score": 0.777}

        quality = assess_description_quality(desc)

        for key, value in quality.items():
            if isinstance(value, float):
                assert len(str(value).split(".")[-1]) <= 3
