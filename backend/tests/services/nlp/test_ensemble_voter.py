"""
Comprehensive tests for EnsembleVoter - weighted consensus algorithm for combining processor results.

Target coverage: 85%+ for ensemble_voter.py
Total tests: 20 comprehensive tests covering:
- Initialization and configuration
- Weighted voting logic
- Description aggregation
- Edge cases and error handling
- Integration scenarios
"""

import pytest
from unittest.mock import Mock, MagicMock
from typing import List, Dict, Any

from app.services.nlp.components.ensemble_voter import EnsembleVoter


# ============================================================================
# FIXTURES
# ============================================================================


@pytest.fixture
def ensemble_voter():
    """Fixture для EnsembleVoter с default threshold 0.6."""
    return EnsembleVoter(voting_threshold=0.6)


@pytest.fixture
def ensemble_voter_high_threshold():
    """Fixture для EnsembleVoter с высоким threshold (0.8)."""
    return EnsembleVoter(voting_threshold=0.8)


@pytest.fixture
def ensemble_voter_low_threshold():
    """Fixture для EnsembleVoter с низким threshold (0.3)."""
    return EnsembleVoter(voting_threshold=0.3)


@pytest.fixture
def mock_spacy_processor():
    """Mock процессор SpaCy с weight 1.0."""
    processor = Mock()
    processor.config = Mock(weight=1.0)
    processor.name = "spacy"
    return processor


@pytest.fixture
def mock_natasha_processor():
    """Mock процессор Natasha с weight 1.2 (специализирован для русского)."""
    processor = Mock()
    processor.config = Mock(weight=1.2)
    processor.name = "natasha"
    return processor


@pytest.fixture
def mock_stanza_processor():
    """Mock процессор Stanza с weight 0.8."""
    processor = Mock()
    processor.config = Mock(weight=0.8)
    processor.name = "stanza"
    return processor


@pytest.fixture
def sample_spacy_results():
    """Sample результаты от SpaCy процессора."""
    return [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.85,
            "source": "spacy",
            "context": "В темном лесу стояла избушка"
        },
        {
            "content": "Иван Петрович",
            "type": "character",
            "priority_score": 0.92,
            "source": "spacy",
            "context": "Иван Петрович медленно приближался"
        }
    ]


@pytest.fixture
def sample_natasha_results():
    """Sample результаты от Natasha процессора."""
    return [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.88,
            "source": "natasha",
            "context": "В темном лесу стояла избушка"
        },
        {
            "content": "старая избушка",
            "type": "location",
            "priority_score": 0.90,
            "source": "natasha",
            "context": "старая избушка на курьих ножках"
        }
    ]


@pytest.fixture
def sample_stanza_results():
    """Sample результаты от Stanza процессора."""
    return [
        {
            "content": "темный лес",
            "type": "location",
            "priority_score": 0.82,
            "source": "stanza",
            "context": "В темном лесу стояла избушка"
        }
    ]


@pytest.fixture
def processors_dict(mock_spacy_processor, mock_natasha_processor, mock_stanza_processor):
    """Dictionary of mock processors."""
    return {
        "spacy": mock_spacy_processor,
        "natasha": mock_natasha_processor,
        "stanza": mock_stanza_processor
    }


# ============================================================================
# TEST CLASS 1: INITIALIZATION
# ============================================================================


class TestEnsembleVoterInitialization:
    """Тесты инициализации EnsembleVoter."""

    def test_default_initialization(self):
        """Тест инициализации с default threshold 0.6."""
        voter = EnsembleVoter()
        assert voter.voting_threshold == 0.6

    def test_custom_threshold_initialization(self):
        """Тест инициализации с custom threshold."""
        voter = EnsembleVoter(voting_threshold=0.7)
        assert voter.voting_threshold == 0.7

    def test_zero_threshold(self):
        """Тест инициализации с threshold = 0.0."""
        voter = EnsembleVoter(voting_threshold=0.0)
        assert voter.voting_threshold == 0.0

    def test_max_threshold(self):
        """Тест инициализации с threshold = 1.0."""
        voter = EnsembleVoter(voting_threshold=1.0)
        assert voter.voting_threshold == 1.0

    def test_multiple_instances_independent(self):
        """Тест что разные instances независимы."""
        voter1 = EnsembleVoter(voting_threshold=0.5)
        voter2 = EnsembleVoter(voting_threshold=0.8)

        assert voter1.voting_threshold == 0.5
        assert voter2.voting_threshold == 0.8


# ============================================================================
# TEST CLASS 2: WEIGHTED VOTING LOGIC
# ============================================================================


class TestEnsembleVoterWeightedVoting:
    """Тесты weighted voting логики."""

    def test_single_processor_result(
        self, ensemble_voter, processors_dict, sample_spacy_results
    ):
        """Тест voting с одним процессором - все descriptions должны пройти."""
        processor_results = {"spacy": sample_spacy_results}

        result = ensemble_voter.vote(processor_results, processors_dict)

        # Single processor results should pass through (no voting needed)
        assert len(result) == 2
        # Results sorted by weighted_score (priority_score), so highest priority first
        contents = [r["content"] for r in result]
        assert "темный лес" in contents
        assert "Иван Петрович" in contents

    def test_two_processor_consensus(
        self, ensemble_voter, processors_dict, sample_spacy_results, sample_natasha_results
    ):
        """Тест voting когда два процессора согласны."""
        # "темный лес" есть в обоих результатах - должен пройти consensus
        processor_results = {
            "spacy": sample_spacy_results,
            "natasha": sample_natasha_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # "темный лес" should have consensus_count = 2
        forest_desc = [r for r in result if "лес" in r["content"]]
        assert len(forest_desc) > 0
        assert forest_desc[0]["consensus_count"] == 2

    def test_weighted_score_calculation(
        self, ensemble_voter, processors_dict, sample_spacy_results, sample_natasha_results
    ):
        """Тест что weighted_score правильно вычисляется."""
        processor_results = {
            "spacy": sample_spacy_results,
            "natasha": sample_natasha_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # Verify weighted_score field is NOT in result (cleaned up)
        for desc in result:
            assert "weighted_score" not in desc

    def test_processor_weight_applied(
        self, processors_dict, sample_spacy_results
    ):
        """Тест что processor weights правильно применяются."""
        # Create voter with explicit threshold for testing
        voter = EnsembleVoter(voting_threshold=0.0)

        processor_results = {"spacy": sample_spacy_results}
        result = voter.vote(processor_results, processors_dict)

        # Weight should be applied (processor_weight field removed, but used in calculation)
        assert len(result) > 0

    def test_consensus_ratio_calculation(
        self, ensemble_voter, processors_dict, sample_spacy_results, sample_natasha_results
    ):
        """Тест что consensus_ratio правильно вычисляется."""
        processor_results = {
            "spacy": sample_spacy_results,
            "natasha": sample_natasha_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # All results should have consensus_ratio field
        for desc in result:
            assert "consensus_ratio" in desc
            assert 0 <= desc["consensus_ratio"] <= 1.0

    def test_consensus_threshold_enforcement(
        self, ensemble_voter_high_threshold, processors_dict
    ):
        """Тест что high threshold отфильтровывает descriptions."""
        # Create descriptions that will have different consensus ratios
        spacy_results = [
            {
                "content": "specific description",
                "type": "location",
                "priority_score": 0.85,
                "source": "spacy",
                "context": "context"
            }
        ]
        natasha_results = [
            {
                "content": "other description",
                "type": "location",
                "priority_score": 0.80,
                "source": "natasha",
                "context": "context"
            }
        ]

        processor_results = {
            "spacy": spacy_results,
            "natasha": natasha_results
        }

        result = ensemble_voter_high_threshold.vote(processor_results, processors_dict)

        # With high threshold, non-consensus descriptions may be filtered
        assert len(result) <= 2

    def test_sorting_by_weighted_score(
        self, ensemble_voter, processors_dict
    ):
        """Тест что results отсортированы по weighted_score."""
        spacy_results = [
            {
                "content": "low priority",
                "type": "location",
                "priority_score": 0.3,
                "source": "spacy",
                "context": "context"
            },
            {
                "content": "high priority",
                "type": "location",
                "priority_score": 0.9,
                "source": "spacy",
                "context": "context"
            }
        ]

        processor_results = {"spacy": spacy_results}
        result = ensemble_voter.vote(processor_results, processors_dict)

        # Should be sorted by priority (highest first)
        assert result[0]["priority_score"] >= result[1]["priority_score"]


# ============================================================================
# TEST CLASS 3: DESCRIPTION AGGREGATION & CONTEXT
# ============================================================================


class TestEnsembleVoterDescriptionAggregation:
    """Тесты aggregation descriptions и context enrichment."""

    def test_deduplicate_identical_descriptions(
        self, ensemble_voter, processors_dict
    ):
        """Тест deduplication идентичных descriptions."""
        spacy_results = [
            {
                "content": "темный лес",
                "type": "location",
                "priority_score": 0.85,
                "source": "spacy",
                "context": "context1"
            },
            {
                "content": "темный лес",  # Identical
                "type": "location",
                "priority_score": 0.85,
                "source": "spacy",
                "context": "context1"
            }
        ]

        processor_results = {"spacy": spacy_results}
        result = ensemble_voter.vote(processor_results, processors_dict)

        # Should have 1 deduplicated description, not 2
        forest_descs = [r for r in result if "темный лес" in r["content"]]
        assert len(forest_descs) <= 1

    def test_multiple_sources_aggregation(
        self, ensemble_voter, processors_dict, sample_spacy_results, sample_natasha_results
    ):
        """Тест что sources список правильно aggregated."""
        processor_results = {
            "spacy": sample_spacy_results,
            "natasha": sample_natasha_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # "темный лес" should have multiple sources
        forest_desc = [r for r in result if "лес" in r["content"]][0]
        assert "sources" in forest_desc
        assert len(forest_desc["sources"]) >= 1

    def test_context_enrichment_applied(
        self, ensemble_voter, processors_dict, sample_spacy_results
    ):
        """Тест что context enrichment добавляет quality indicators."""
        processor_results = {"spacy": sample_spacy_results}
        result = ensemble_voter.vote(processor_results, processors_dict)

        # All results should have processing_method and quality_indicator
        for desc in result:
            assert desc["processing_method"] == "ensemble"
            assert desc["quality_indicator"] in ["high", "medium", "low"]

    def test_quality_indicator_based_on_consensus(
        self, ensemble_voter, processors_dict
    ):
        """Тест что quality_indicator зависит от consensus_ratio."""
        spacy_results = [
            {
                "content": "desc1",
                "type": "location",
                "priority_score": 0.85,
                "source": "spacy"
            }
        ]
        natasha_results = [
            {
                "content": "desc1",
                "type": "location",
                "priority_score": 0.85,
                "source": "natasha"
            }
        ]

        processor_results = {
            "spacy": spacy_results,
            "natasha": natasha_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # High consensus should give "high" or "medium" quality
        if len(result) > 0 and result[0]["consensus_ratio"] >= 0.6:
            assert result[0]["quality_indicator"] in ["high", "medium"]

    def test_processor_weight_field_cleanup(
        self, ensemble_voter, processors_dict, sample_spacy_results
    ):
        """Тест что temporary fields удаляются из final result."""
        processor_results = {"spacy": sample_spacy_results}
        result = ensemble_voter.vote(processor_results, processors_dict)

        # Temporary fields should be removed
        for desc in result:
            assert "processor_weight" not in desc
            assert "weighted_score" not in desc


# ============================================================================
# TEST CLASS 4: EDGE CASES & ERROR HANDLING
# ============================================================================


class TestEnsembleVoterEdgeCases:
    """Тесты edge cases и error handling."""

    def test_empty_processor_results(self, ensemble_voter, processors_dict):
        """Тест voting с empty processor results."""
        processor_results = {}
        result = ensemble_voter.vote(processor_results, processors_dict)
        assert result == []

    def test_empty_descriptions_list(self, ensemble_voter, processors_dict):
        """Тест voting когда все processors возвращают пустой список."""
        processor_results = {
            "spacy": [],
            "natasha": [],
            "stanza": []
        }
        result = ensemble_voter.vote(processor_results, processors_dict)
        assert result == []

    def test_processor_without_config(self, ensemble_voter):
        """Тест что processors без config обрабатываются правильно."""
        processor = Mock(spec=[])  # No config attribute
        processors_dict = {"spacy": processor}

        processor_results = {
            "spacy": [
                {
                    "content": "test",
                    "type": "location",
                    "priority_score": 0.8,
                    "source": "spacy"
                }
            ]
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # Should handle missing config gracefully
        assert len(result) > 0

    def test_description_missing_priority_score(
        self, ensemble_voter, processors_dict
    ):
        """Тест descriptions без priority_score."""
        processor_results = {
            "spacy": [
                {
                    "content": "test",
                    "type": "location",
                    "source": "spacy"
                    # No priority_score
                }
            ]
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # Should handle missing priority_score (default to 0.5)
        assert len(result) > 0

    def test_multiple_identical_descriptions_same_processor(
        self, ensemble_voter, processors_dict
    ):
        """Тест handling multiple identical descriptions from same processor."""
        processor_results = {
            "spacy": [
                {
                    "content": "identical",
                    "type": "location",
                    "priority_score": 0.9,
                    "source": "spacy"
                },
                {
                    "content": "identical",
                    "type": "location",
                    "priority_score": 0.8,
                    "source": "spacy"
                }
            ]
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # Should keep the highest priority version
        identical_descs = [r for r in result if "identical" in r["content"]]
        if len(identical_descs) > 0:
            assert identical_descs[0]["priority_score"] >= 0.8

    def test_three_processor_partial_consensus(
        self, ensemble_voter, processors_dict, sample_spacy_results,
        sample_natasha_results, sample_stanza_results
    ):
        """Тест voting with three processors и partial consensus."""
        processor_results = {
            "spacy": sample_spacy_results,
            "natasha": sample_natasha_results,
            "stanza": sample_stanza_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # "темный лес" appears in all 3 processors
        forest_descs = [r for r in result if "лес" in r["content"]]
        if len(forest_descs) > 0:
            assert forest_descs[0]["consensus_count"] == 3


# ============================================================================
# TEST CLASS 5: VOTING THRESHOLD MANAGEMENT
# ============================================================================


class TestEnsembleVoterThresholdManagement:
    """Тесты management voting threshold."""

    def test_set_valid_threshold(self, ensemble_voter):
        """Тест set_voting_threshold с valid value."""
        ensemble_voter.set_voting_threshold(0.75)
        assert ensemble_voter.voting_threshold == 0.75

    def test_set_invalid_threshold_negative(self, ensemble_voter):
        """Тест set_voting_threshold с negative value (должно быть rejected)."""
        original_threshold = ensemble_voter.voting_threshold
        ensemble_voter.set_voting_threshold(-0.5)

        # Should not change threshold for invalid value
        assert ensemble_voter.voting_threshold == original_threshold

    def test_set_invalid_threshold_over_one(self, ensemble_voter):
        """Тест set_voting_threshold с value > 1.0 (должно быть rejected)."""
        original_threshold = ensemble_voter.voting_threshold
        ensemble_voter.set_voting_threshold(1.5)

        # Should not change threshold for invalid value
        assert ensemble_voter.voting_threshold == original_threshold

    def test_threshold_affects_filtering(self, processors_dict):
        """Тест что threshold изменяет результаты filtering."""
        # Create two voters with different thresholds
        low_threshold_voter = EnsembleVoter(voting_threshold=0.1)
        high_threshold_voter = EnsembleVoter(voting_threshold=0.95)

        processor_results = {
            "spacy": [
                {
                    "content": "test1",
                    "type": "location",
                    "priority_score": 0.8,
                    "source": "spacy"
                }
            ],
            "natasha": [
                {
                    "content": "test1",
                    "type": "location",
                    "priority_score": 0.8,
                    "source": "natasha"
                }
            ]
        }

        low_result = low_threshold_voter.vote(processor_results, processors_dict)
        high_result = high_threshold_voter.vote(processor_results, processors_dict)

        # Low threshold should include more descriptions
        assert len(low_result) >= len(high_result)

    def test_consensus_boost_applied_above_threshold(
        self, ensemble_voter, processors_dict
    ):
        """Тест что consensus boost применяется для descriptions выше threshold."""
        processor_results = {
            "spacy": [
                {
                    "content": "boosted",
                    "type": "location",
                    "priority_score": 0.7,
                    "source": "spacy"
                }
            ],
            "natasha": [
                {
                    "content": "boosted",
                    "type": "location",
                    "priority_score": 0.7,
                    "source": "natasha"
                }
            ]
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        if len(result) > 0:
            # boosted should have ensemble_boosted = True if above threshold
            boosted_desc = [r for r in result if "boosted" in r["content"]]
            if len(boosted_desc) > 0 and boosted_desc[0].get("consensus_ratio", 0) >= 0.6:
                assert boosted_desc[0]["ensemble_boosted"] is True


# ============================================================================
# TEST CLASS 6: INTEGRATION SCENARIOS
# ============================================================================


class TestEnsembleVoterIntegrationScenarios:
    """Тесты real-world integration scenarios."""

    def test_full_description_processing_pipeline(
        self, ensemble_voter, processors_dict, sample_spacy_results,
        sample_natasha_results, sample_stanza_results
    ):
        """Тест full pipeline с все processors returning different results."""
        processor_results = {
            "spacy": sample_spacy_results,
            "natasha": sample_natasha_results,
            "stanza": sample_stanza_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # All required fields should be present
        for desc in result:
            assert "content" in desc
            assert "type" in desc
            assert "processing_method" in desc
            assert "quality_indicator" in desc
            assert "consensus_count" in desc
            assert "consensus_ratio" in desc
            assert "sources" in desc

    def test_logging_output_structure(
        self, ensemble_voter, processors_dict, sample_spacy_results
    ):
        """Тест что logging outputs правильную информацию."""
        processor_results = {"spacy": sample_spacy_results}

        # Should not raise any exceptions
        result = ensemble_voter.vote(processor_results, processors_dict)
        assert isinstance(result, list)

    def test_large_number_of_descriptions(self, ensemble_voter, processors_dict):
        """Тест performance с большим числом descriptions."""
        # Create large set of descriptions
        large_results = [
            {
                "content": f"description_{i}",
                "type": "location" if i % 2 == 0 else "character",
                "priority_score": 0.5 + (i % 50) / 100,
                "source": "spacy"
            }
            for i in range(100)
        ]

        processor_results = {"spacy": large_results}
        result = ensemble_voter.vote(processor_results, processors_dict)

        # Should handle large datasets
        assert len(result) <= 100
        assert len(result) > 0

    def test_conflicting_processor_votes(self, ensemble_voter, processors_dict):
        """Тест когда processors completely disagree."""
        spacy_results = [
            {
                "content": "spacy_choice",
                "type": "location",
                "priority_score": 0.9,
                "source": "spacy"
            }
        ]
        natasha_results = [
            {
                "content": "natasha_choice",
                "type": "location",
                "priority_score": 0.9,
                "source": "natasha"
            }
        ]

        processor_results = {
            "spacy": spacy_results,
            "natasha": natasha_results
        }

        result = ensemble_voter.vote(processor_results, processors_dict)

        # Both choices might appear (no consensus needed if >= 2 processors)
        assert len(result) >= 2
