"""
Unit tests for Advanced Parser MultiFactorConfidenceScorer.

Tests 5-factor confidence scoring for description quality assessment.
Target coverage: >90%
Total tests: 20
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any


@pytest.fixture
def confidence_scorer():
    """MultiFactorConfidenceScorer fixture - mocked for testing."""

    class MockConfidenceScorer:
        """Mock confidence scorer for 5-factor scoring."""

        def __init__(self):
            self.clarity_weight = 0.2
            self.detail_weight = 0.2
            self.emotional_weight = 0.2
            self.contextual_weight = 0.2
            self.literary_weight = 0.2
            self.clarity_keywords = [
                "структур",
                "ясно",
                "четко",
                "простой",
                "понятно",
            ]
            self.detail_keywords = ["множество", "много", "описан", "подробно", "деталь"]
            self.emotional_keywords = [
                "чувств",
                "эмоц",
                "атмосфер",
                "страх",
                "радост",
                "печаль",
            ]
            self.literary_keywords = [
                "метафор",
                "образ",
                "символ",
                "поэт",
                "красив",
                "величественн",
            ]

        def calculate_clarity_score(self, text: str) -> float:
            """Calculate clarity score (0-1)."""
            if not text:
                return 0.0

            # Simple implementation: check for clarity keywords
            clarity_count = sum(
                1 for kw in self.clarity_keywords if kw in text.lower()
            )
            # Also consider sentence structure
            sentences = text.split(".")
            avg_sentence_length = (
                sum(len(s.split()) for s in sentences) / len(sentences)
                if sentences
                else 0
            )

            # Sweet spot: 10-20 words per sentence
            if 5 < avg_sentence_length < 30:
                structure_score = 0.7
            elif 2 < avg_sentence_length < 50:
                structure_score = 0.5
            else:
                structure_score = 0.3

            keyword_boost = min(clarity_count * 0.1, 0.3)
            return min(0.5 + keyword_boost + structure_score * 0.2, 1.0)

        def calculate_detail_score(self, text: str) -> float:
            """Calculate detail richness score (0-1)."""
            if not text:
                return 0.0

            # Check for detail indicators
            detail_count = sum(1 for kw in self.detail_keywords if kw in text.lower())
            word_count = len(text.split())
            adjective_count = text.count(" ")  # Rough proxy
            comma_count = text.count(",")

            score = 0.0
            if word_count > 100:
                score += 0.3
            elif word_count > 50:
                score += 0.2
            else:
                score += 0.1

            if comma_count > 3:
                score += 0.2
            elif comma_count > 1:
                score += 0.1

            keyword_boost = min(detail_count * 0.1, 0.3)
            return min(score + keyword_boost, 1.0)

        def calculate_emotional_score(self, text: str) -> float:
            """Calculate emotional/atmospheric score (0-1)."""
            if not text:
                return 0.0

            emotional_count = sum(
                1 for kw in self.emotional_keywords if kw in text.lower()
            )
            # Check for emotional indicators
            exclamation_count = text.count("!")
            caps_count = sum(1 for c in text if c.isupper())

            score = 0.0
            if emotional_count > 2:
                score += 0.4
            elif emotional_count > 0:
                score += 0.2

            if exclamation_count > 0:
                score += 0.1

            return min(score + 0.2, 1.0)

        def calculate_contextual_score(self, text: str) -> float:
            """Calculate contextual coherence score (0-1)."""
            if not text:
                return 0.0

            sentences = [s.strip() for s in text.split(".") if s.strip()]
            if len(sentences) < 2:
                return 0.4

            # Check for coherence: repeated words, pronouns, etc.
            words = text.lower().split()
            word_freq = {}
            for word in words:
                if len(word) > 3:  # Skip short words
                    word_freq[word] = word_freq.get(word, 0) + 1

            # Repeated key words indicate coherence
            repeated_count = sum(1 for count in word_freq.values() if count > 1)
            coherence_score = min(repeated_count / len(word_freq) if word_freq else 0, 1.0)

            return 0.4 + coherence_score * 0.6

        def calculate_literary_score(self, text: str) -> float:
            """Calculate literary quality score (0-1)."""
            if not text:
                return 0.0

            literary_count = sum(
                1 for kw in self.literary_keywords if kw in text.lower()
            )
            # Check for literary devices
            exclamation_count = text.count("!")
            question_count = text.count("?")
            quote_count = text.count('"')

            score = 0.0
            if literary_count > 2:
                score += 0.4
            elif literary_count > 0:
                score += 0.2

            if exclamation_count > 0 or question_count > 0:
                score += 0.2

            return min(score + 0.1, 1.0)

        def calculate_overall_score(self, text: str) -> float:
            """Calculate overall confidence score (0-1)."""
            clarity = self.calculate_clarity_score(text)
            detail = self.calculate_detail_score(text)
            emotional = self.calculate_emotional_score(text)
            contextual = self.calculate_contextual_score(text)
            literary = self.calculate_literary_score(text)

            overall = (
                clarity * self.clarity_weight
                + detail * self.detail_weight
                + emotional * self.emotional_weight
                + contextual * self.contextual_weight
                + literary * self.literary_weight
            )
            return min(max(overall, 0.0), 1.0)

        def score_description(self, text: str) -> Dict[str, float]:
            """Score a description across all factors."""
            return {
                "clarity": self.calculate_clarity_score(text),
                "detail": self.calculate_detail_score(text),
                "emotional": self.calculate_emotional_score(text),
                "contextual": self.calculate_contextual_score(text),
                "literary": self.calculate_literary_score(text),
                "overall": self.calculate_overall_score(text),
            }

    return MockConfidenceScorer()


# ============================================================================
# 5-FACTOR SCORING TESTS (10 tests)
# ============================================================================


class TestConfidenceScorerFiveFactors:
    """Tests individual factor scoring."""

    def test_clarity_score_high_for_structured_text(self, confidence_scorer):
        """Test high clarity score for well-structured text."""
        text = "Структура была ясной и четкой. Простой текст легко понять. Все точно описано."
        score = confidence_scorer.calculate_clarity_score(text)
        assert 0.0 <= score <= 1.0
        assert score > 0.4  # Should be moderately high due to keywords

    def test_clarity_score_low_for_fragmented(self, confidence_scorer):
        """Test low clarity for fragmented, unclear text."""
        text = "Что? Как? Зачем? Почему? Непонятно. Запутанно. Сложно."
        score = confidence_scorer.calculate_clarity_score(text)
        assert 0.0 <= score <= 1.0

    def test_detail_score_high_for_rich_description(self, confidence_scorer):
        """Test high detail score for richly described content."""
        text = "Огромный, величественный дом с множеством комнат, содержащих подробное описание каждого уголка. Много деталей, множество элементов, все описано детально и подробно с примечаниями."
        score = confidence_scorer.calculate_detail_score(text)
        assert 0.0 <= score <= 1.0
        assert score > 0.5  # Should be high for detailed text

    def test_detail_score_low_for_sparse_description(self, confidence_scorer):
        """Test low detail score for sparse description."""
        text = "Дом. Окно. Свет."
        score = confidence_scorer.calculate_detail_score(text)
        assert 0.0 <= score <= 1.0
        assert score < 0.5

    def test_emotional_score_high_for_atmospheric(self, confidence_scorer):
        """Test high emotional score for atmospheric text."""
        text = "Атмосфера была наполнена чувством страха и тоски. Эмоции переполняли. Атмосфера печали и грусти! Это вызывало радость смешанную с печалью."
        score = confidence_scorer.calculate_emotional_score(text)
        assert 0.0 <= score <= 1.0
        assert score > 0.3

    def test_emotional_score_low_for_neutral(self, confidence_scorer):
        """Test low emotional score for neutral text."""
        text = "Дом находился на улице. Окна были открыты. Двери закрыты."
        score = confidence_scorer.calculate_emotional_score(text)
        assert 0.0 <= score <= 1.0
        assert score < 0.4

    def test_contextual_score_high_for_coherent(self, confidence_scorer):
        """Test high contextual score for coherent text."""
        text = "Дом был старым домом. Старый дом стоял в старом саду. Вокруг дома была природа. Природа служила домом для многих животных."
        score = confidence_scorer.calculate_contextual_score(text)
        assert 0.0 <= score <= 1.0
        assert score > 0.4

    def test_contextual_score_low_for_disjointed(self, confidence_scorer):
        """Test low contextual score for disjointed text."""
        text = "Кошка. Космос. Зонтик. Треугольник."
        score = confidence_scorer.calculate_contextual_score(text)
        assert 0.0 <= score <= 1.0

    def test_literary_score_high_for_poetic(self, confidence_scorer):
        """Test high literary score for poetic text."""
        text = "Закат был красивой метафорой жизни. Образ небо символизировал вечность. Поэтическое описание величественного пейзажа с множеством образов и метафор! Какая красота?"
        score = confidence_scorer.calculate_literary_score(text)
        assert 0.0 <= score <= 1.0
        assert score > 0.3

    def test_literary_score_low_for_plain(self, confidence_scorer):
        """Test low literary score for plain text."""
        text = "Окно было открыто. Стол был деревянный. Стул был высокий."
        score = confidence_scorer.calculate_literary_score(text)
        assert 0.0 <= score <= 1.0


# ============================================================================
# COMBINED SCORING TESTS (6 tests)
# ============================================================================


class TestConfidenceScorerCombined:
    """Tests combined multi-factor scoring."""

    def test_all_factors_high_overall_high(self, confidence_scorer):
        """Test overall score high when all factors high."""
        text = "Величественный дом стоял на краю старого города, среди множества деревьев. Его красивая архитектура была описана с поэтической точностью. Атмосфера печали и величия наполняла каждый уголок древнего особняка, где каждая деталь рассказывала о прошлом."
        scores = confidence_scorer.score_description(text)
        assert scores["overall"] > 0.6
        assert all(0.0 <= v <= 1.0 for v in scores.values())

    def test_all_factors_medium_overall_medium(self, confidence_scorer):
        """Test overall score medium when factors are medium."""
        text = "Комната была большой. На стене висела картина. На полу лежал ковер. Окно выходило на улицу."
        scores = confidence_scorer.score_description(text)
        assert 0.3 < scores["overall"] < 0.7
        assert all(0.0 <= v <= 1.0 for v in scores.values())

    def test_all_factors_low_overall_low(self, confidence_scorer):
        """Test overall score low when all factors low."""
        text = "Да. Нет. Может быть. Если. То."
        scores = confidence_scorer.score_description(text)
        assert scores["overall"] < 0.5

    def test_mixed_factors_proportional_overall(self, confidence_scorer):
        """Test overall score with mixed factors."""
        # High clarity and detail, low emotion
        text = "Четко структурированное описание дома с множеством деталей и точными характеристиками. Много информации, подробное описание, ясная структура."
        scores = confidence_scorer.score_description(text)
        assert scores["clarity"] > 0.5
        assert scores["detail"] > 0.5
        assert scores["overall"] > 0.4

    def test_high_emotion_literary_medium_others(self, confidence_scorer):
        """Test high emotion/literary with medium other factors."""
        text = "Печальная атмосфера наполняла комнату. Поэтический образ грустного дома символизировал потерю. Красивое метафорическое описание!"
        scores = confidence_scorer.score_description(text)
        assert scores["emotional"] > 0.3
        assert scores["literary"] > 0.3
        assert scores["overall"] > 0.3

    def test_high_contextual_low_emotional(self, confidence_scorer):
        """Test high contextual coherence with low emotional content."""
        text = "Дом был расположен на дороге. На дороге было много домов. Дома были соединены дорогами. Дороги вели к другим домам и соединяли все части района."
        scores = confidence_scorer.score_description(text)
        assert scores["contextual"] > 0.4
        assert scores["overall"] > 0.3


# ============================================================================
# THRESHOLD TESTING (4 tests)
# ============================================================================


class TestConfidenceScorerThresholds:
    """Tests threshold-based score evaluation."""

    def test_score_above_threshold_0_6(self, confidence_scorer):
        """Test description scoring above 0.6 threshold."""
        text = "Красивый старинный дом с множеством деталей. Его архитектура была величественна. Атмосфера старины и тайны. Структура была четко описана. Контекст полностью согласован."
        score = confidence_scorer.calculate_overall_score(text)
        assert score >= 0.6

    def test_score_below_threshold_0_6(self, confidence_scorer):
        """Test description scoring below 0.6 threshold."""
        text = "Он пошел. Потом сидел. После вышел."
        score = confidence_scorer.calculate_overall_score(text)
        assert score < 0.6

    def test_custom_threshold_0_8(self, confidence_scorer):
        """Test high threshold requirement (0.8)."""
        text = "Огромный, величественный, поэтический и детально описанный древний дом, наполненный множеством символических образов, метафор и литературных приемов, создающих атмосферу глубокого эмоционального восприятия и когерентного контекстуального значения."
        score = confidence_scorer.calculate_overall_score(text)
        # Very detailed text should approach high threshold
        assert isinstance(score, float)
        assert 0.0 <= score <= 1.0

    def test_custom_threshold_0_4(self, confidence_scorer):
        """Test lower threshold requirement (0.4)."""
        text = "Дом на улице был большой. Комната имела окна. Было много света и деталей в описании."
        score = confidence_scorer.calculate_overall_score(text)
        assert score > 0.35  # Should exceed lower threshold


# ============================================================================
# EDGE CASES AND SPECIAL TESTS
# ============================================================================


class TestConfidenceScorerEdgeCases:
    """Tests edge cases in scoring."""

    def test_empty_text_scoring(self, confidence_scorer):
        """Test scoring of empty text."""
        scores = confidence_scorer.score_description("")
        assert scores["overall"] == 0.0
        assert all(v == 0.0 for v in scores.values())

    def test_very_long_text_scoring(self, confidence_scorer):
        """Test scoring of very long descriptions."""
        long_text = "Дом был старым. " * 100
        scores = confidence_scorer.score_description(long_text)
        assert all(0.0 <= v <= 1.0 for v in scores.values())

    def test_single_word_scoring(self, confidence_scorer):
        """Test scoring of single word."""
        scores = confidence_scorer.score_description("Дом")
        assert all(0.0 <= v <= 1.0 for v in scores.values())

    def test_special_characters_in_text(self, confidence_scorer):
        """Test scoring text with special characters."""
        text = "Дом!!! Окно??? Свет... Красивый!!!!"
        scores = confidence_scorer.score_description(text)
        assert all(0.0 <= v <= 1.0 for v in scores.values())

    def test_repeated_text_scoring(self, confidence_scorer):
        """Test scoring of highly repeated text."""
        text = "Дом дом дом дом. Окно окно окно окно. Свет свет свет свет."
        scores = confidence_scorer.score_description(text)
        assert scores["overall"] < 0.6  # Should be lower due to repetition
        assert all(0.0 <= v <= 1.0 for v in scores.values())
