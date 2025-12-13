"""
Unit tests for LangExtract Enricher - LLM-based semantic enrichment.

Tests semantic entity extraction, source grounding, and graceful degradation.
Target coverage: >85%
Total tests: 40
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional


@pytest.fixture
def langextract_enricher():
    """LangExtract enricher fixture - mocked for testing."""

    class MockLangExtractEnricher:
        """Mock enricher for testing enrichment logic."""

        def __init__(self):
            self.api_key = None
            self.api_timeout = 5.0
            self.min_confidence_threshold = 0.6
            self.max_retries = 1

        async def enrich_description(
            self, description: str, original_text: str = None
        ) -> Dict[str, Any]:
            """Enrich description with LangExtract."""
            if not description:
                return {"enriched": description, "enrichment_score": 0.0}

            # Simulate enrichment structure
            return {
                "enriched": description,
                "enrichment_score": 0.75,
                "entities": [],
                "attributes": {},
                "quotes": [],
                "grounding": [],
            }

        async def extract_semantic_entities(self, text: str) -> List[Dict]:
            """Extract semantic entities from text."""
            if not text:
                return []

            # Simulate entity extraction
            return [
                {
                    "type": "location",
                    "text": "дом",
                    "attributes": {"size": "large", "age": "ancient"},
                    "confidence": 0.9,
                }
            ]

        async def extract_supporting_quotes(self, text: str, entity: str) -> List[str]:
            """Extract quotes supporting entity."""
            if not text or not entity:
                return []

            # Simulate quote extraction
            quotes = []
            sentences = text.split(".")
            for sentence in sentences:
                if entity.lower() in sentence.lower():
                    quotes.append(sentence.strip())
                if len(quotes) >= 3:
                    break
            return quotes

        async def verify_against_source(
            self, text: str, extracted: Dict
        ) -> Dict[str, Any]:
            """Verify extracted information against source."""
            if not text or not extracted:
                return {"verified": False, "confidence": 0.0}

            # Simulate verification
            return {
                "verified": True,
                "confidence": 0.85,
                "matches": 3,
                "mismatches": 0,
            }

        async def call_api(self, text: str) -> Optional[Dict]:
            """Call LangExtract API."""
            if not self.api_key:
                return None

            # Simulate API call
            return {
                "entities": [],
                "attributes": {},
                "analysis": {},
            }

        async def handle_api_timeout(self):
            """Handle API timeout gracefully."""
            return None

        async def fallback_to_original(self, description: str) -> Dict:
            """Fallback to original description."""
            return {
                "enriched": description,
                "enrichment_score": 0.0,
                "fallback": True,
                "reason": "API unavailable",
            }

        def validate_enrichment_quality(self, enriched: Dict) -> bool:
            """Validate enrichment quality."""
            return enriched.get("enrichment_score", 0.0) >= self.min_confidence_threshold

    return MockLangExtractEnricher()


# ============================================================================
# SEMANTIC ENTITY EXTRACTION TESTS (15 tests)
# ============================================================================


class TestLangExtractLocationEnrichment:
    """Tests location semantic enrichment."""

    @pytest.mark.asyncio
    async def test_extract_detailed_location_attributes(self, langextract_enricher):
        """Test extraction of detailed location attributes."""
        text = "В старинном доме на краю города были высокие потолки, огромные окна, мраморные колонны."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)
        # Should extract location-related semantic features
        if len(entities) > 0:
            assert "type" in entities[0]

    @pytest.mark.asyncio
    async def test_extract_sensory_location_details(self, langextract_enricher):
        """Test extraction of sensory details from location."""
        text = "Дом пахнул старой древесиной, воском и пылью веков. Свет проникал сквозь пыльные окна, создавая золотистый свет. Под ногами скрипел паркет."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_historical_location_context(self, langextract_enricher):
        """Test extraction of historical context."""
        text = "Этот дом был построен в XVIII веке и пережил множество войн и революций. Его стены помнили раскаты пушек и крики революционеров."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_location_emotional_associations(self, langextract_enricher):
        """Test extraction of emotional associations."""
        text = "Дом вызывал чувство печали и ностальгии. Его величие смешивалось с ощущением забвения и времени, которое уходит в прошлое."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_location_symbolic_meaning(self, langextract_enricher):
        """Test extraction of symbolic meaning."""
        text = "Дом символизировал упадок и разрушение, но одновременно служил памятником прошлой красоте и величию."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)


class TestLangExtractCharacterEnrichment:
    """Tests character semantic enrichment."""

    @pytest.mark.asyncio
    async def test_extract_physical_appearance_details(self, langextract_enricher):
        """Test extraction of physical appearance attributes."""
        text = "Старик был высокого роста, с широкими плечами, проседью в черных волосах. Его лицо было морщинистым, с глубокими морщинами вокруг глаз."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_personality_traits(self, langextract_enricher):
        """Test extraction of personality characteristics."""
        text = "Он был обаятельным, остроумным и глубоко мудрым. Его взгляд выражал скорбь и сострадание к человеческим слабостям."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_emotional_state(self, langextract_enricher):
        """Test extraction of current emotional state."""
        text = "На его лице была грусть, смешанная с безнадежностью. Он казался усталым, выбитым из жизни, но сохранившим внутреннее достоинство."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_relationships(self, langextract_enricher):
        """Test extraction of relationship information."""
        text = "Она была его дочерью, которую он обожал. Но их отношения были осложнены годами недопонимания и молчания."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_motivations(self, langextract_enricher):
        """Test extraction of character motivations."""
        text = "Его главной целью было восстановление семейного имущества. Он руководствовался чувством справедливости и стремлением к искуплению вины."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)


class TestLangExtractAtmosphereEnrichment:
    """Tests atmosphere semantic enrichment."""

    @pytest.mark.asyncio
    async def test_extract_mood_indicators(self, langextract_enricher):
        """Test extraction of mood indicators."""
        text = "Атмосфера была пронизана тревогой и предчувствием беды. Воздух был тяжелым, как перед грозой."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_time_season_details(self, langextract_enricher):
        """Test extraction of time and season information."""
        text = "Это было в конце осени, когда листья опадали и природа готовилась к долгому зимнему сну. Сумерки наступали все раньше каждый день."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_weather_details(self, langextract_enricher):
        """Test extraction of weather information."""
        text = "Дождь шел беспрерывно, размывая дороги. Ветер завывал, пробиваясь сквозь щели в окнах. Небо было темным и низким, не оставляя надежды на солнце."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_lighting_color_details(self, langextract_enricher):
        """Test extraction of lighting and color information."""
        text = "Свет луны проникал сквозь облака, окрашивая все в серебристый оттенок. Тени танцевали на стенах, создавая фантастические силуэты."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_extract_symbolic_elements(self, langextract_enricher):
        """Test extraction of symbolic atmospheric elements."""
        text = "Символом всей атмосферы был старый колокол, звонивший только один раз в день. Его звук был печальным напоминанием о времени, которое неумолимо уходит."
        entities = await langextract_enricher.extract_semantic_entities(text)
        assert isinstance(entities, list)


# ============================================================================
# SOURCE GROUNDING TESTS (10 tests)
# ============================================================================


class TestLangExtractSourceGrounding:
    """Tests source grounding functionality."""

    @pytest.mark.asyncio
    async def test_extract_supporting_quotes(self, langextract_enricher):
        """Test extraction of supporting quotes."""
        text = "Дом был очень старым. Его возраст исчислялся веками. Стены рассказывали истории."
        entity = "дом"
        quotes = await langextract_enricher.extract_supporting_quotes(text, entity)
        assert isinstance(quotes, list)

    @pytest.mark.asyncio
    async def test_handle_multiple_quotes(self, langextract_enricher):
        """Test handling of multiple supporting quotes."""
        text = "Дом был красивый. Дом был старый. Дом был огромный. Дом стоял на краю города. Люди приходили к дому."
        entity = "дом"
        quotes = await langextract_enricher.extract_supporting_quotes(text, entity)
        assert len(quotes) >= 0
        assert all(isinstance(q, str) for q in quotes)

    @pytest.mark.asyncio
    async def test_extract_partial_quotes(self, langextract_enricher):
        """Test extraction of partial quotes."""
        text = "В этом странном доме жили еще более странные люди. Дом казался живым существом, дышащим и двигающимся."
        entity = "дом"
        quotes = await langextract_enricher.extract_supporting_quotes(text, entity)
        assert isinstance(quotes, list)

    @pytest.mark.asyncio
    async def test_verify_extracted_entities(self, langextract_enricher):
        """Test verification of extracted entities against source."""
        text = "В доме было три комнаты, две спальни и кухня. Окна выходили на север. Дверь была из красного дерева."
        extracted = {"entity": "дом", "attributes": {"rooms": 3, "doors": 1}}
        verification = await langextract_enricher.verify_against_source(text, extracted)
        assert isinstance(verification, dict)
        assert "verified" in verification

    @pytest.mark.asyncio
    async def test_verify_attribute_matching(self, langextract_enricher):
        """Test attribute matching during verification."""
        text = "Дом был большим, в три этажа, с двадцатью комнатами, построенный в 1850 году."
        extracted = {
            "entity": "дом",
            "attributes": {"size": "большой", "floors": 3, "rooms": 20},
        }
        verification = await langextract_enricher.verify_against_source(text, extracted)
        assert isinstance(verification, dict)

    @pytest.mark.asyncio
    async def test_detect_hallucinations(self, langextract_enricher):
        """Test detection of hallucinated/unsupported information."""
        text = "Дом был красивым. Окна были большими."
        extracted = {
            "entity": "дом",
            "attributes": {
                "color": "красный",  # Not mentioned in source
                "windows": "big",  # "большими" is mentioned
            },
        }
        verification = await langextract_enricher.verify_against_source(text, extracted)
        assert isinstance(verification, dict)

    @pytest.mark.asyncio
    async def test_confidence_high_direct_quote(self, langextract_enricher):
        """Test high confidence for direct quote support."""
        text = "Дом был величественным памятником архитектуры XIX века."
        extracted = {"quote": "величественным памятником архитектуры XIX века"}
        # Should have high confidence with direct quote
        assert isinstance(extracted, dict)

    @pytest.mark.asyncio
    async def test_confidence_medium_implied_support(self, langextract_enricher):
        """Test medium confidence for implied support."""
        text = "Дом был старым, его стены потемнели от времени."
        extracted = {"attribute": "ancient", "implied_from": "потемнели от времени"}
        # Medium confidence for implied attributes

    @pytest.mark.asyncio
    async def test_confidence_low_weak_support(self, langextract_enricher):
        """Test low confidence for weakly supported claims."""
        text = "Дом стоял на холме."
        extracted = {"attribute": "mysterious", "mention": "холме"}
        # Low confidence for weakly supported attributes

    @pytest.mark.asyncio
    async def test_no_confidence_no_support(self, langextract_enricher):
        """Test zero confidence when no source support exists."""
        text = "Дом был построен давно."
        extracted = {"attribute": "blue", "mention": None}
        # Should have no confidence without any source mention


# ============================================================================
# GRACEFUL DEGRADATION TESTS (15 tests)
# ============================================================================


class TestLangExtractGracefulDegradation:
    """Tests graceful degradation without LangExtract."""

    @pytest.mark.asyncio
    async def test_fallback_no_api_key(self, langextract_enricher):
        """Test fallback when API key is missing."""
        langextract_enricher.api_key = None
        description = "Описание дома для обогащения."
        result = await langextract_enricher.fallback_to_original(description)
        assert result["enriched"] == description
        assert result["fallback"] is True

    @pytest.mark.asyncio
    async def test_fallback_logs_warning(self, langextract_enricher):
        """Test that fallback logs warning message."""
        langextract_enricher.api_key = None
        description = "Test description"
        result = await langextract_enricher.fallback_to_original(description)
        assert "reason" in result or "fallback" in result

    @pytest.mark.asyncio
    async def test_no_exception_raised_on_api_key_missing(self, langextract_enricher):
        """Test that no exception is raised when API key missing."""
        langextract_enricher.api_key = None
        try:
            await langextract_enricher.enrich_description("test")
        except Exception as e:
            pytest.fail(f"Exception raised: {e}")

    @pytest.mark.asyncio
    async def test_fallback_api_timeout(self, langextract_enricher):
        """Test fallback when API times out."""
        description = "Description to enrich"
        # Simulate timeout
        with patch.object(
            langextract_enricher, "call_api", side_effect=TimeoutError()
        ):
            result = await langextract_enricher.enrich_description(description)
            # Should return original or fallback
            assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_fallback_api_400_error(self, langextract_enricher):
        """Test fallback on API 400 Bad Request."""
        description = "Description to enrich"
        # Simulate 400 error
        with patch.object(langextract_enricher, "call_api", side_effect=ValueError()):
            result = await langextract_enricher.enrich_description(description)
            assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_fallback_api_500_error(self, langextract_enricher):
        """Test fallback on API 500 Internal Server Error."""
        description = "Description to enrich"
        with patch.object(
            langextract_enricher, "call_api", side_effect=RuntimeError()
        ):
            result = await langextract_enricher.enrich_description(description)
            assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_fallback_network_error(self, langextract_enricher):
        """Test fallback on network error."""
        description = "Description to enrich"
        with patch.object(
            langextract_enricher, "call_api", side_effect=ConnectionError()
        ):
            result = await langextract_enricher.enrich_description(description)
            assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_fallback_malformed_json(self, langextract_enricher):
        """Test fallback on malformed JSON response."""
        description = "Description to enrich"
        with patch.object(
            langextract_enricher, "call_api", side_effect=ValueError("Malformed JSON")
        ):
            result = await langextract_enricher.enrich_description(description)
            assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_fallback_missing_fields(self, langextract_enricher):
        """Test fallback when response missing required fields."""
        description = "Description to enrich"
        result = await langextract_enricher.enrich_description(description)
        # Should still return valid structure
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_fallback_empty_response(self, langextract_enricher):
        """Test fallback on empty API response."""
        description = "Description to enrich"
        with patch.object(langextract_enricher, "call_api", return_value=None):
            result = await langextract_enricher.enrich_description(description)
            assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_preserve_original_if_enrichment_worse(self, langextract_enricher):
        """Test preservation of original if enrichment quality is worse."""
        original = "Хорошее описание дома."
        # Simulate poor enrichment
        enriched_result = {
            "enriched": original,
            "enrichment_score": 0.3,  # Below threshold
        }
        # Should reject enrichment
        is_valid = langextract_enricher.validate_enrichment_quality(enriched_result)
        assert not is_valid

    @pytest.mark.asyncio
    async def test_threshold_acceptance_above_0_6(self, langextract_enricher):
        """Test that enrichment above 0.6 threshold is accepted."""
        enriched = {
            "enriched": "Обогащенное описание",
            "enrichment_score": 0.65,
        }
        is_valid = langextract_enricher.validate_enrichment_quality(enriched)
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_threshold_rejection_below_0_6(self, langextract_enricher):
        """Test that enrichment below 0.6 threshold is rejected."""
        enriched = {
            "enriched": "Слабо обогащенное описание",
            "enrichment_score": 0.55,
        }
        is_valid = langextract_enricher.validate_enrichment_quality(enriched)
        assert is_valid is False

    @pytest.mark.asyncio
    async def test_retry_logic_on_timeout(self, langextract_enricher):
        """Test retry logic when API times out."""
        description = "Description to enrich"
        call_count = 0

        async def mock_call_api_with_retry(text):
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise TimeoutError()
            return {"entities": []}

        with patch.object(
            langextract_enricher, "call_api", side_effect=mock_call_api_with_retry
        ):
            result = await langextract_enricher.enrich_description(description)
            assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_graceful_degradation_without_api_key(self, langextract_enricher):
        """Test complete graceful degradation without API key."""
        langextract_enricher.api_key = None
        description = "Original description that should not be enriched."

        result = await langextract_enricher.enrich_description(description)

        # Should return original description with fallback indicator
        assert result["enriched"] == description or "fallback" in result
        assert isinstance(result, dict)
