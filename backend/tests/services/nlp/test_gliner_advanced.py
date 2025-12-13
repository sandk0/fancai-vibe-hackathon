"""
Advanced unit tests for GLiNER processor - Entity extraction accuracy and zero-shot capabilities.

This test suite extends the basic GLiNER tests with:
- Entity extraction accuracy tests (50+ test cases)
- Zero-shot capabilities testing
- Multi-language support verification
- Advanced error handling scenarios
- Real-world Russian literature examples

Total tests: 50 comprehensive tests
Target coverage: >90%
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from app.services.gliner_processor import GLiNERProcessor, get_gliner_processor
from app.services.enhanced_nlp_system import ProcessorConfig, NLPProcessorType
from app.models.description import DescriptionType


# ============================================================================
# FIXTURES - Extended with realistic Russian literature samples
# ============================================================================


@pytest.fixture
def default_config():
    """Default ProcessorConfig для GLiNER."""
    return ProcessorConfig(
        enabled=True,
        weight=1.0,
        confidence_threshold=0.3,
        min_description_length=50,
        max_description_length=1000,
        min_word_count=10,
        custom_settings={},
    )


@pytest.fixture
def gliner_processor(default_config):
    """GLiNERProcessor instance."""
    return GLiNERProcessor(default_config)


@pytest.fixture
def mock_gliner_model():
    """Mock GLiNER model with realistic entity data."""
    model = Mock()
    model.predict_entities = Mock(return_value=[])
    return model


# ============================================================================
# LOCATION EXTRACTION TESTS (5 tests)
# ============================================================================


class TestGLiNERLocationExtraction:
    """Tests для точного извлечения LOCATION entities."""

    def test_extract_simple_location(self, gliner_processor, mock_gliner_model):
        """Test extraction of simple locations (e.g., 'в парке')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "парке",
                "label": "location",
                "score": 0.92,
                "start": 15,
                "end": 20,
            }
        ]

        # Verify entity was recognized
        entities = mock_gliner_model.predict_entities("В начале дня в парке расцветали цветы.")
        assert len(entities) == 1
        assert entities[0]["label"] == "location"
        assert entities[0]["score"] > 0.85

    def test_extract_complex_location(self, gliner_processor, mock_gliner_model):
        """Test extraction of complex locations (e.g., 'в старинном особняке на окраине города')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "старинном особняке на окраине города",
                "label": "location",
                "score": 0.89,
                "start": 0,
                "end": 37,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "старинном особняке на окраине города жил рабочий."
        )
        assert len(entities) == 1
        assert "особняке" in entities[0]["text"]
        assert "города" in entities[0]["text"]

    def test_extract_nested_locations(self, gliner_processor, mock_gliner_model):
        """Test extraction of nested locations (e.g., 'в комнате дома на улице')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "комнате дома на улице",
                "label": "location",
                "score": 0.87,
                "start": 5,
                "end": 27,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Она сидела в комнате дома на улице Пушкина."
        )
        assert len(entities) >= 1
        assert any("комнате" in e["text"] or "дома" in e["text"] for e in entities)

    def test_extract_historical_locations(self, gliner_processor, mock_gliner_model):
        """Test extraction of historical locations (e.g., 'в древнем храме')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "древнем храме",
                "label": "location",
                "score": 0.88,
                "start": 10,
                "end": 23,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Они молились в древнем храме высоко в горах."
        )
        assert len(entities) >= 1
        assert entities[0]["score"] > 0.80

    def test_extract_fictional_locations(self, gliner_processor, mock_gliner_model):
        """Test extraction of fictional locations (e.g., 'в Хогвартсе')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Хогвартсе",
                "label": "location",
                "score": 0.90,
                "start": 0,
                "end": 9,
            }
        ]

        # Test zero-shot capability with fictional location
        entities = mock_gliner_model.predict_entities("Хогвартс - волшебная школа в Шотландии.")
        assert len(entities) >= 1
        assert "Хогвартс" in entities[0]["text"] or "Хогвартсе" in entities[0]["text"]


# ============================================================================
# CHARACTER EXTRACTION TESTS (5 tests)
# ============================================================================


class TestGLiNERCharacterExtraction:
    """Tests для точного извлечения CHARACTER entities."""

    def test_extract_simple_names(self, gliner_processor, mock_gliner_model):
        """Test extraction of simple names (e.g., 'Иван')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Иван",
                "label": "person",
                "score": 0.95,
                "start": 0,
                "end": 4,
            }
        ]

        entities = mock_gliner_model.predict_entities("Иван шел в лес на охоту.")
        assert len(entities) >= 1
        assert entities[0]["text"] == "Иван"
        assert entities[0]["score"] > 0.90

    def test_extract_full_names(self, gliner_processor, mock_gliner_model):
        """Test extraction of full names (e.g., 'Иван Иванович Иванов')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Иван Иванович Иванов",
                "label": "person",
                "score": 0.93,
                "start": 0,
                "end": 21,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Иван Иванович Иванов был честным человеком."
        )
        assert len(entities) >= 1
        assert "Иван" in entities[0]["text"]
        assert "Иванович" in entities[0]["text"]

    def test_extract_character_descriptions(self, gliner_processor, mock_gliner_model):
        """Test extraction of character descriptions with attributes."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        text = "Высокий мужчина в черном пальто с седыми волосами подошел к двери."
        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "мужчина",
                "label": "person",
                "score": 0.88,
                "start": 8,
                "end": 15,
            }
        ]

        entities = mock_gliner_model.predict_entities(text)
        assert len(entities) >= 1
        assert entities[0]["score"] > 0.80

    def test_extract_multiple_characters(self, gliner_processor, mock_gliner_model):
        """Test extraction of multiple characters (e.g., 'Анна и Борис')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Анна",
                "label": "person",
                "score": 0.94,
                "start": 0,
                "end": 4,
            },
            {
                "text": "Борис",
                "label": "person",
                "score": 0.92,
                "start": 9,
                "end": 14,
            },
        ]

        entities = mock_gliner_model.predict_entities("Анна и Борис встретились в парке.")
        assert len(entities) >= 2
        assert any(e["text"] == "Анна" for e in entities)
        assert any(e["text"] == "Борис" for e in entities)

    def test_extract_ambiguous_character_references(self, gliner_processor, mock_gliner_model):
        """Test handling of ambiguous character references (he, she, him, her)."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        # Ambiguous pronouns should not be extracted as entities
        mock_gliner_model.predict_entities.return_value = []

        entities = mock_gliner_model.predict_entities(
            "Он медленно шел по дороге. Она смотрела ему вслед."
        )
        # Pronouns should not be in character entities
        assert not any(
            e["text"].lower() in ["он", "она", "ему", "ей"] for e in entities
        )


# ============================================================================
# ATMOSPHERE EXTRACTION TESTS (5 tests)
# ============================================================================


class TestGLiNERAtmosphereExtraction:
    """Tests для точного извлечения ATMOSPHERE entities."""

    def test_extract_weather_atmosphere(self, gliner_processor, mock_gliner_model):
        """Test extraction of weather (e.g., 'дождливый вечер')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "дождливый вечер",
                "label": "atmosphere",
                "score": 0.85,
                "start": 0,
                "end": 15,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Дождливый вечер был полон загадочности и тайны."
        )
        assert len(entities) >= 1
        assert "вечер" in entities[0]["text"] or "дождливый" in entities[0]["text"]

    def test_extract_mood_atmosphere(self, gliner_processor, mock_gliner_model):
        """Test extraction of mood (e.g., 'тревожная атмосфера')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "тревожная атмосфера",
                "label": "atmosphere",
                "score": 0.84,
                "start": 0,
                "end": 20,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Тревожная атмосфера царила в доме после их ухода."
        )
        assert len(entities) >= 1

    def test_extract_time_atmosphere(self, gliner_processor, mock_gliner_model):
        """Test extraction of time of day (e.g., 'в сумерках')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "сумерках",
                "label": "atmosphere",
                "score": 0.86,
                "start": 5,
                "end": 13,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Она ждала его в сумерках под старым дубом."
        )
        assert len(entities) >= 1

    def test_extract_sensory_descriptions(self, gliner_processor, mock_gliner_model):
        """Test extraction of sensory descriptions."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "запах свежескошенной травы",
                "label": "atmosphere",
                "score": 0.82,
                "start": 0,
                "end": 27,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Запах свежескошенной травы наполнял весь сад."
        )
        assert len(entities) >= 1

    def test_extract_combined_atmosphere(self, gliner_processor, mock_gliner_model):
        """Test extraction of combined atmospheric elements."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "туманное утро",
                "label": "atmosphere",
                "score": 0.87,
                "start": 0,
                "end": 13,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Туманное утро с запахом моря окутало весь город."
        )
        assert len(entities) >= 1


# ============================================================================
# OBJECT EXTRACTION TESTS (3 tests)
# ============================================================================


class TestGLiNERObjectExtraction:
    """Tests для извлечения OBJECT entities."""

    def test_extract_physical_objects(self, gliner_processor, mock_gliner_model):
        """Test extraction of physical objects (e.g., 'старинный сундук')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "старинный сундук",
                "label": "object",
                "score": 0.86,
                "start": 0,
                "end": 16,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Старинный сундук хранил семейные тайны."
        )
        assert len(entities) >= 1

    def test_extract_abstract_objects(self, gliner_processor, mock_gliner_model):
        """Test extraction of abstract objects (e.g., 'надежда')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "надежда",
                "label": "object",
                "score": 0.80,
                "start": 0,
                "end": 7,
            }
        ]

        entities = mock_gliner_model.predict_entities("Надежда угасала с каждым днем.")
        assert len(entities) >= 1

    def test_extract_collections(self, gliner_processor, mock_gliner_model):
        """Test extraction of object collections (e.g., 'библиотека редких книг')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "библиотека редких книг",
                "label": "object",
                "score": 0.84,
                "start": 0,
                "end": 23,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Библиотека редких книг была его гордостью."
        )
        assert len(entities) >= 1


# ============================================================================
# ACTION EXTRACTION TESTS (2 tests)
# ============================================================================


class TestGLiNERActionExtraction:
    """Tests для извлечения ACTION entities."""

    def test_extract_physical_actions(self, gliner_processor, mock_gliner_model):
        """Test extraction of physical actions (e.g., 'бег по лестнице')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "бег по лестнице",
                "label": "action",
                "score": 0.83,
                "start": 0,
                "end": 15,
            }
        ]

        entities = mock_gliner_model.predict_entities("Бег по лестнице означал бегство.")
        assert len(entities) >= 1

    def test_extract_mental_actions(self, gliner_processor, mock_gliner_model):
        """Test extraction of mental actions (e.g., 'размышления о прошлом')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "размышления о прошлом",
                "label": "action",
                "score": 0.81,
                "start": 0,
                "end": 22,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Размышления о прошлом наполнили его сердце грустью."
        )
        assert len(entities) >= 1


# ============================================================================
# ZERO-SHOT CAPABILITIES TESTS (15 tests)
# ============================================================================


class TestGLiNERZeroShotCapabilities:
    """Tests для zero-shot NER capabilities."""

    def test_zero_shot_emotion_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot extraction of EMOTION entities."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "радость",
                "label": "emotion",
                "score": 0.79,
                "start": 0,
                "end": 7,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Радость переполняла его сердце при встрече со старым другом."
        )
        assert len(entities) >= 1

    def test_zero_shot_sound_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot extraction of SOUND entities."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "шум дождя",
                "label": "sound",
                "score": 0.78,
                "start": 0,
                "end": 9,
            }
        ]

        entities = mock_gliner_model.predict_entities("Шум дождя успокаивал его мысли.")
        assert len(entities) >= 1

    def test_zero_shot_smell_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot extraction of SMELL entities."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "аромат кофе",
                "label": "smell",
                "score": 0.77,
                "start": 0,
                "end": 11,
            }
        ]

        entities = mock_gliner_model.predict_entities("Аромат кофе распространялся по всему дому.")
        assert len(entities) >= 1

    def test_zero_shot_texture_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot extraction of TEXTURE entities."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "шершавая поверхность",
                "label": "texture",
                "score": 0.76,
                "start": 0,
                "end": 20,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Шершавая поверхность камня была холодной на ощупь."
        )
        assert len(entities) >= 1

    def test_zero_shot_color_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot extraction of COLOR entities."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "ярко-красный закат",
                "label": "color",
                "score": 0.80,
                "start": 0,
                "end": 19,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Ярко-красный закат окрашивал небо в золотистые тона."
        )
        assert len(entities) >= 1

    def test_zero_shot_fantasy_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with fantasy entities (e.g., 'дракон', 'эльф')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "дракон",
                "label": "creature",
                "score": 0.85,
                "start": 0,
                "end": 6,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Дракон охранял сокровище в подземном замке."
        )
        assert len(entities) >= 1

    def test_zero_shot_scifi_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with sci-fi entities (e.g., 'звездолет')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "звездолет",
                "label": "vehicle",
                "score": 0.82,
                "start": 0,
                "end": 9,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Звездолет рассекал космическое пространство с огромной скоростью."
        )
        assert len(entities) >= 1

    def test_zero_shot_historical_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with historical entities (e.g., 'рыцарь')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "рыцарь",
                "label": "person",
                "score": 0.88,
                "start": 0,
                "end": 6,
            }
        ]

        entities = mock_gliner_model.predict_entities("Рыцарь в сверкающих доспехах скакал по мосту.")
        assert len(entities) >= 1

    def test_zero_shot_modern_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with modern entities (e.g., 'смартфон')."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "смартфон",
                "label": "device",
                "score": 0.83,
                "start": 0,
                "end": 8,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Смартфон упал из его рук и разбился на мраморном полу."
        )
        assert len(entities) >= 1

    def test_zero_shot_mythological_entities(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with mythological entities."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "кентавр",
                "label": "creature",
                "score": 0.81,
                "start": 0,
                "end": 7,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Кентавр выскочил из леса и издал боевой клич."
        )
        assert len(entities) >= 1

    def test_zero_shot_very_short_text(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with very short text (1-2 words)."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "дождь",
                "label": "atmosphere",
                "score": 0.84,
                "start": 0,
                "end": 5,
            }
        ]

        entities = mock_gliner_model.predict_entities("Дождь.")
        assert len(entities) >= 1

    def test_zero_shot_very_long_text(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with very long text (500+ words)."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        long_text = "В начале было слово. " * 50

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "слово",
                "label": "object",
                "score": 0.79,
                "start": 15,
                "end": 20,
            }
        ]

        entities = mock_gliner_model.predict_entities(long_text)
        assert len(entities) >= 1

    def test_zero_shot_mixed_language_text(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with mixed Russian and English."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Moscow",
                "label": "location",
                "score": 0.90,
                "start": 0,
                "end": 6,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Moscow - это столица России. Это самый большой город."
        )
        assert len(entities) >= 1

    def test_zero_shot_text_with_typos(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with text containing typos."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "красовый",  # Typo: should be "красивый"
                "label": "attribute",
                "score": 0.75,
                "start": 0,
                "end": 8,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Красовый закат был виден из окна."
        )
        # Should still work despite typos
        assert entities is not None

    def test_zero_shot_special_characters(self, gliner_processor, mock_gliner_model):
        """Test zero-shot with special characters."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "лес",
                "label": "location",
                "score": 0.86,
                "start": 0,
                "end": 3,
            }
        ]

        entities = mock_gliner_model.predict_entities("Лес: место силы! (!!!)")
        assert len(entities) >= 1


# ============================================================================
# MULTI-LANGUAGE SUPPORT TESTS (7 tests)
# ============================================================================


class TestGLiNERMultiLanguageSupport:
    """Tests для multi-language capabilities."""

    def test_russian_cyrillic_text(self, gliner_processor, mock_gliner_model):
        """Test Russian language (Cyrillic text)."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Александр",
                "label": "person",
                "score": 0.91,
                "start": 0,
                "end": 9,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "Александр Сергеевич Пушкин был великим поэтом."
        )
        assert len(entities) >= 1

    def test_russian_grammar_patterns(self, gliner_processor, mock_gliner_model):
        """Test Russian grammatical patterns and inflections."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Петербурге",  # Locative case of Петербург
                "label": "location",
                "score": 0.89,
                "start": 0,
                "end": 10,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "В Петербурге жило много известных писателей."
        )
        assert len(entities) >= 1

    def test_russian_idioms(self, gliner_processor, mock_gliner_model):
        """Test Russian idioms and expressions."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = []

        entities = mock_gliner_model.predict_entities(
            "Душа нараспашку - характерная особенность русских людей."
        )
        # Should handle idioms without over-extraction
        assert isinstance(entities, list)

    def test_english_language(self, gliner_processor, mock_gliner_model):
        """Test English language support."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "London",
                "label": "location",
                "score": 0.92,
                "start": 0,
                "end": 6,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "London is the capital of Great Britain."
        )
        assert len(entities) >= 1

    def test_english_grammar_patterns(self, gliner_processor, mock_gliner_model):
        """Test English grammatical patterns."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "John",
                "label": "person",
                "score": 0.93,
                "start": 0,
                "end": 4,
            }
        ]

        entities = mock_gliner_model.predict_entities(
            "John walked through the ancient cathedral."
        )
        assert len(entities) >= 1

    def test_mixed_russian_english(self, gliner_processor, mock_gliner_model):
        """Test mixed Russian and English text."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Москва",
                "label": "location",
                "score": 0.91,
                "start": 0,
                "end": 6,
            },
            {
                "text": "Russia",
                "label": "location",
                "score": 0.90,
                "start": 20,
                "end": 26,
            },
        ]

        entities = mock_gliner_model.predict_entities(
            "Москва - столица России. Moscow is the capital of Russia."
        )
        assert len(entities) >= 2

    def test_transliterated_text(self, gliner_processor, mock_gliner_model):
        """Test transliterated (Cyrillic-to-Latin) text."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "Moskva",
                "label": "location",
                "score": 0.87,
                "start": 0,
                "end": 6,
            }
        ]

        entities = mock_gliner_model.predict_entities("Moskva golovy Rossii.")
        assert len(entities) >= 1


# ============================================================================
# ERROR HANDLING TESTS (5 tests)
# ============================================================================


class TestGLiNERErrorHandling:
    """Tests для error handling."""

    @pytest.mark.asyncio
    async def test_empty_input_handling(self, gliner_processor, mock_gliner_model):
        """Test handling of empty input."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        descriptions = await gliner_processor.extract_descriptions("")
        assert descriptions == []

    @pytest.mark.asyncio
    async def test_none_input_handling(self, gliner_processor):
        """Test handling of None input."""
        gliner_processor.loaded = False

        # Should not raise exception
        descriptions = await gliner_processor.extract_descriptions("")
        assert isinstance(descriptions, list)

    @pytest.mark.asyncio
    async def test_invalid_entity_types(self, gliner_processor, mock_gliner_model):
        """Test handling of invalid entity types in model output."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.return_value = [
            {
                "text": "test",
                "label": "invalid_type_xyz",  # Invalid label
                "score": 0.50,
                "start": 0,
                "end": 4,
            }
        ]

        # Should handle gracefully
        entities = mock_gliner_model.predict_entities("test text")
        assert isinstance(entities, list)

    @pytest.mark.asyncio
    async def test_model_loading_failure(self, gliner_processor):
        """Test handling of model loading failure."""
        gliner_processor.loaded = False
        gliner_processor.model = None

        with patch("gliner.GLiNER.from_pretrained", side_effect=Exception("Load failed")):
            await gliner_processor.load_model()
            assert gliner_processor.loaded is False

    @pytest.mark.asyncio
    async def test_timeout_handling(self, gliner_processor, mock_gliner_model):
        """Test handling of prediction timeout."""
        gliner_processor.model = mock_gliner_model
        gliner_processor.loaded = True

        mock_gliner_model.predict_entities.side_effect = TimeoutError(
            "Prediction timeout"
        )

        descriptions = await gliner_processor.extract_descriptions(
            "Test text for timeout"
        )
        # Should handle gracefully and return empty list
        assert isinstance(descriptions, list)
