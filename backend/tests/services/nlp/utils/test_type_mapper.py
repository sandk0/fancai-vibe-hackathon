"""
Unit tests for type_mapper.py utilities.

Tests all entity type mapping functions:
- map_entity_to_description_type (generic)
- map_spacy_entity_to_description_type
- map_natasha_entity_to_description_type
- map_stanza_entity_to_description_type
- determine_type_by_keywords
- get_supported_entity_types
"""

import pytest
from app.services.nlp.utils.type_mapper import (
    map_entity_to_description_type,
    map_spacy_entity_to_description_type,
    map_natasha_entity_to_description_type,
    map_stanza_entity_to_description_type,
    determine_type_by_keywords,
    get_supported_entity_types,
    EntityType,
)
from app.models.description import DescriptionType


# ============================================================================
# TESTS: map_entity_to_description_type (Generic Mapping)
# ============================================================================


class TestMapEntityToDescriptionType:
    """Test suite for generic entity type mapping."""

    def test_person_to_character(self):
        """Test PERSON entity maps to character description."""
        result = map_entity_to_description_type("PERSON")
        assert result == DescriptionType.CHARACTER.value

    def test_per_to_character(self):
        """Test PER entity maps to character description."""
        result = map_entity_to_description_type("PER")
        assert result == DescriptionType.CHARACTER.value

    def test_loc_to_location(self):
        """Test LOC entity maps to location description."""
        result = map_entity_to_description_type("LOC")
        assert result == DescriptionType.LOCATION.value

    def test_gpe_to_location(self):
        """Test GPE (spaCy) maps to location."""
        result = map_entity_to_description_type("GPE")
        assert result == DescriptionType.LOCATION.value

    def test_fac_to_location(self):
        """Test FAC (spaCy facility) maps to location."""
        result = map_entity_to_description_type("FAC")
        assert result == DescriptionType.LOCATION.value

    def test_org_to_object(self):
        """Test ORG entity maps to object description."""
        result = map_entity_to_description_type("ORG")
        assert result == DescriptionType.OBJECT.value

    def test_misc_to_object(self):
        """Test MISC entity maps to object description."""
        result = map_entity_to_description_type("MISC")
        assert result == DescriptionType.OBJECT.value

    def test_case_insensitive(self):
        """Test mapping is case insensitive."""
        assert (
            map_entity_to_description_type("person")
            == map_entity_to_description_type("PERSON")
            == map_entity_to_description_type("Person")
        )

    def test_unknown_entity_type(self):
        """Test unknown entity type returns None."""
        result = map_entity_to_description_type("UNKNOWN_TYPE")
        assert result is None

    def test_empty_string(self):
        """Test empty string returns None."""
        result = map_entity_to_description_type("")
        assert result is None

    def test_none_input(self):
        """Test None input returns None."""
        result = map_entity_to_description_type(None)
        assert result is None

    def test_processor_parameter_generic(self):
        """Test generic processor parameter."""
        result = map_entity_to_description_type("PERSON", processor="generic")
        assert result == DescriptionType.CHARACTER.value

    def test_processor_parameter_ignored(self):
        """Test processor parameter doesn't affect generic mapping."""
        result_spacy = map_entity_to_description_type("PERSON", processor="spacy")
        result_natasha = map_entity_to_description_type("PERSON", processor="natasha")

        # Both should map the same way
        assert result_spacy == result_natasha


# ============================================================================
# TESTS: map_spacy_entity_to_description_type
# ============================================================================


class TestMapSpacyEntityToDescriptionType:
    """Test suite for spaCy-specific entity mapping."""

    def test_spacy_person(self):
        """Test spaCy PERSON entity."""
        result = map_spacy_entity_to_description_type("PERSON")
        assert result == DescriptionType.CHARACTER.value

    def test_spacy_gpe(self):
        """Test spaCy GPE (geo-political entity)."""
        result = map_spacy_entity_to_description_type("GPE")
        assert result == DescriptionType.LOCATION.value

    def test_spacy_loc(self):
        """Test spaCy LOC."""
        result = map_spacy_entity_to_description_type("LOC")
        assert result == DescriptionType.LOCATION.value

    def test_spacy_fac(self):
        """Test spaCy FAC (facility)."""
        result = map_spacy_entity_to_description_type("FAC")
        assert result == DescriptionType.LOCATION.value

    def test_spacy_org(self):
        """Test spaCy ORG."""
        result = map_spacy_entity_to_description_type("ORG")
        assert result == DescriptionType.OBJECT.value


# ============================================================================
# TESTS: map_natasha_entity_to_description_type
# ============================================================================


class TestMapNatashaEntityToDescriptionType:
    """Test suite for Natasha-specific entity mapping."""

    def test_natasha_per(self):
        """Test Natasha PER (person) entity."""
        result = map_natasha_entity_to_description_type("PER")
        assert result == DescriptionType.CHARACTER.value

    def test_natasha_loc(self):
        """Test Natasha LOC entity."""
        result = map_natasha_entity_to_description_type("LOC")
        assert result == DescriptionType.LOCATION.value

    def test_natasha_org(self):
        """Test Natasha ORG entity."""
        result = map_natasha_entity_to_description_type("ORG")
        assert result == DescriptionType.OBJECT.value

    def test_natasha_case_insensitive(self):
        """Test Natasha mapping is case insensitive."""
        result_upper = map_natasha_entity_to_description_type("PER")
        result_lower = map_natasha_entity_to_description_type("per")

        assert result_upper == result_lower


# ============================================================================
# TESTS: map_stanza_entity_to_description_type
# ============================================================================


class TestMapStanzaEntityToDescriptionType:
    """Test suite for Stanza-specific entity mapping."""

    def test_stanza_per(self):
        """Test Stanza PER entity."""
        result = map_stanza_entity_to_description_type("PER")
        assert result == DescriptionType.CHARACTER.value

    def test_stanza_loc(self):
        """Test Stanza LOC entity."""
        result = map_stanza_entity_to_description_type("LOC")
        assert result == DescriptionType.LOCATION.value

    def test_stanza_org(self):
        """Test Stanza ORG entity."""
        result = map_stanza_entity_to_description_type("ORG")
        assert result == DescriptionType.OBJECT.value

    def test_stanza_misc(self):
        """Test Stanza MISC entity."""
        result = map_stanza_entity_to_description_type("MISC")
        assert result == DescriptionType.OBJECT.value


# ============================================================================
# TESTS: determine_type_by_keywords
# ============================================================================


class TestDetermineTypeByKeywords:
    """Test suite for keyword-based type determination."""

    def test_location_keywords(self):
        """Test detection of location keywords."""
        text = "дом стоял на холме"
        result = determine_type_by_keywords(text)

        assert result == DescriptionType.LOCATION.value

    def test_character_keywords(self):
        """Test detection of character keywords."""
        text = "девушка была красива с длинными волосами"
        result = determine_type_by_keywords(text)

        assert result == DescriptionType.CHARACTER.value

    def test_atmosphere_keywords(self):
        """Test detection of atmosphere keywords."""
        text = "воздух был свежим и холодным"
        result = determine_type_by_keywords(text)

        assert result == DescriptionType.ATMOSPHERE.value

    def test_multiple_location_keywords(self):
        """Test multiple location keywords."""
        text = "замок стоял у реки в лесу"
        result = determine_type_by_keywords(text)

        # Should detect multiple location words (замок, река, лес)
        assert result == DescriptionType.LOCATION.value

    def test_mixed_keywords_highest_wins(self):
        """Test that highest scoring type wins with mixed keywords."""
        # 2 location keywords vs 1 character keyword
        text = "дом в городе где жила девушка"
        result = determine_type_by_keywords(text)

        # Location should win (2 matches vs 1)
        assert result == DescriptionType.LOCATION.value

    def test_no_keywords_returns_object(self):
        """Test default to OBJECT when no keywords match."""
        text = "просто какой-то текст без ключевых слов"
        result = determine_type_by_keywords(text)

        assert result == DescriptionType.OBJECT.value

    def test_case_insensitive(self):
        """Test keyword matching is case insensitive."""
        text_lower = "дом стоял"
        text_upper = "ДОМ СТОЯЛ"
        text_mixed = "Дом Стоял"

        result_lower = determine_type_by_keywords(text_lower)
        result_upper = determine_type_by_keywords(text_upper)
        result_mixed = determine_type_by_keywords(text_mixed)

        assert result_lower == result_upper == result_mixed

    def test_specific_location_keywords(self):
        """Test specific location keywords."""
        locations = [
            ("город", DescriptionType.LOCATION.value),
            ("лес", DescriptionType.LOCATION.value),
            ("река", DescriptionType.LOCATION.value),
            ("замок", DescriptionType.LOCATION.value),
            ("комната", DescriptionType.LOCATION.value),
        ]

        for keyword, expected_type in locations:
            result = determine_type_by_keywords(f"Это был {keyword}")
            assert result == expected_type

    def test_specific_character_keywords(self):
        """Test specific character keywords."""
        characters = [
            ("человек", DescriptionType.CHARACTER.value),
            ("девушка", DescriptionType.CHARACTER.value),
            ("герой", DescriptionType.CHARACTER.value),
            ("глаза", DescriptionType.CHARACTER.value),
        ]

        for keyword, expected_type in characters:
            result = determine_type_by_keywords(f"Был {keyword}")
            assert result == expected_type

    def test_specific_atmosphere_keywords(self):
        """Test specific atmosphere keywords."""
        atmosphere = [
            ("воздух", DescriptionType.ATMOSPHERE.value),
            ("тишина", DescriptionType.ATMOSPHERE.value),
            ("туман", DescriptionType.ATMOSPHERE.value),
            ("свет", DescriptionType.ATMOSPHERE.value),
        ]

        for keyword, expected_type in atmosphere:
            result = determine_type_by_keywords(f"Была {keyword}")
            assert result == expected_type

    def test_tie_breaking(self):
        """Test behavior when multiple types have same score."""
        # Equal scores - should consistently return one type
        text = "дом девушка воздух"  # 1 of each type

        result = determine_type_by_keywords(text)

        # Should be one of the three types (deterministic based on max() order)
        assert result in [
            DescriptionType.LOCATION.value,
            DescriptionType.CHARACTER.value,
            DescriptionType.ATMOSPHERE.value,
        ]


# ============================================================================
# TESTS: get_supported_entity_types
# ============================================================================


class TestGetSupportedEntityTypes:
    """Test suite for getting supported entity types per processor."""

    def test_spacy_supported_types(self):
        """Test spaCy supported entity types."""
        types = get_supported_entity_types("spacy")

        assert isinstance(types, list)
        assert "PERSON" in types
        assert "LOC" in types
        assert "GPE" in types
        assert "FAC" in types
        assert "ORG" in types

    def test_natasha_supported_types(self):
        """Test Natasha supported entity types."""
        types = get_supported_entity_types("natasha")

        assert isinstance(types, list)
        assert "PER" in types
        assert "LOC" in types
        assert "ORG" in types

    def test_stanza_supported_types(self):
        """Test Stanza supported entity types."""
        types = get_supported_entity_types("stanza")

        assert isinstance(types, list)
        assert "PER" in types
        assert "LOC" in types
        assert "ORG" in types
        assert "MISC" in types

    def test_all_supported_types(self):
        """Test getting all unique entity types."""
        types = get_supported_entity_types("all")

        assert isinstance(types, list)
        # Should contain unique types from all processors
        assert len(types) > 0
        # Should contain types from different processors
        assert "PERSON" in types  # spaCy
        assert "PER" in types  # Natasha, Stanza
        assert "GPE" in types  # spaCy
        assert "MISC" in types  # Stanza

    def test_all_types_unique(self):
        """Test that 'all' returns unique types."""
        types = get_supported_entity_types("all")

        # Should not have duplicates
        assert len(types) == len(set(types))

    def test_unknown_processor(self):
        """Test unknown processor returns empty list."""
        types = get_supported_entity_types("unknown_processor")

        assert types == []

    def test_default_processor_all(self):
        """Test default behavior without processor parameter."""
        # Without explicit test, just ensure it doesn't crash
        # (function doesn't have default parameter in signature)
        pass

    def test_spacy_types_count(self):
        """Test spaCy returns expected number of types."""
        types = get_supported_entity_types("spacy")

        # Should have PERSON, LOC, GPE, FAC, ORG
        assert len(types) == 5

    def test_natasha_types_count(self):
        """Test Natasha returns expected number of types."""
        types = get_supported_entity_types("natasha")

        # Should have PER, LOC, ORG
        assert len(types) == 3

    def test_stanza_types_count(self):
        """Test Stanza returns expected number of types."""
        types = get_supported_entity_types("stanza")

        # Should have PER, LOC, ORG, MISC
        assert len(types) == 4


# ============================================================================
# INTEGRATION TESTS
# ============================================================================


class TestEntityTypeMappingIntegration:
    """Integration tests for complete entity type mapping flow."""

    def test_all_processors_person_to_character(self):
        """Test all processors map person entities to character."""
        # spaCy
        assert (
            map_spacy_entity_to_description_type("PERSON")
            == DescriptionType.CHARACTER.value
        )

        # Natasha
        assert (
            map_natasha_entity_to_description_type("PER")
            == DescriptionType.CHARACTER.value
        )

        # Stanza
        assert (
            map_stanza_entity_to_description_type("PER")
            == DescriptionType.CHARACTER.value
        )

    def test_all_processors_location_mapping(self):
        """Test all processors map location entities correctly."""
        # spaCy (multiple location types)
        assert (
            map_spacy_entity_to_description_type("LOC")
            == DescriptionType.LOCATION.value
        )
        assert (
            map_spacy_entity_to_description_type("GPE")
            == DescriptionType.LOCATION.value
        )

        # Natasha
        assert (
            map_natasha_entity_to_description_type("LOC")
            == DescriptionType.LOCATION.value
        )

        # Stanza
        assert (
            map_stanza_entity_to_description_type("LOC")
            == DescriptionType.LOCATION.value
        )

    def test_keyword_fallback_consistency(self):
        """Test keyword-based detection is consistent with entity mapping."""
        # Location keyword
        keyword_result = determine_type_by_keywords("дом в лесу")
        entity_result = map_entity_to_description_type("LOC")

        assert keyword_result == entity_result

    def test_complete_type_mapping_pipeline(self):
        """Test complete type mapping from entity to description type."""
        # Scenario: spaCy detects "PERSON" -> should map to "character"
        entity_type = "PERSON"
        description_type = map_spacy_entity_to_description_type(entity_type)

        assert description_type == DescriptionType.CHARACTER.value

        # Scenario: Natasha detects "LOC" -> should map to "location"
        entity_type = "LOC"
        description_type = map_natasha_entity_to_description_type(entity_type)

        assert description_type == DescriptionType.LOCATION.value

        # Scenario: No entity detected -> use keywords
        text = "красивый замок"
        description_type = determine_type_by_keywords(text)

        assert description_type == DescriptionType.LOCATION.value
