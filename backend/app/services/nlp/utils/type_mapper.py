"""
Entity type mapping utilities for NLP processors.

Extracted from duplicated type mapping logic across:
- natasha_processor.py (_map_natasha_entity_to_description_type)
- stanza_processor.py (_map_stanza_entity_to_description_type)
- nlp_processor.py (_analyze_sentence_spacy)

This module provides unified entity-to-description type mapping.
"""

from typing import Optional
from enum import Enum
from ....models.description import DescriptionType


class EntityType(str, Enum):
    """Стандартизированные типы именованных сущностей из различных NLP библиотек."""

    # Персоны / Characters
    PERSON = "PERSON"
    PER = "PER"

    # Локации / Locations
    LOCATION = "LOC"
    GPE = "GPE"  # Geo-Political Entity (spaCy)
    FAC = "FAC"  # Facility (spaCy)

    # Организации / Organizations
    ORGANIZATION = "ORG"

    # Разное / Misc
    MISC = "MISC"
    OBJECT = "OBJECT"


def map_entity_to_description_type(
    entity_type: str, processor: str = "generic"
) -> Optional[str]:
    """
    Преобразует тип именованной сущности в тип описания BookReader.

    Поддерживает типы сущностей от различных NLP процессоров:
    - spaCy (PERSON, LOC, GPE, FAC, ORG)
    - Natasha (PER, LOC, ORG)
    - Stanza (PER, LOC, ORG, MISC)

    Args:
        entity_type: Тип сущности от NLP процессора
        processor: Название процессора ("spacy", "natasha", "stanza", "generic")

    Returns:
        Тип описания BookReader или None если не найдено соответствие

    Example:
        >>> map_entity_to_description_type("PERSON", "spacy")
        'character'

        >>> map_entity_to_description_type("LOC", "natasha")
        'location'

        >>> map_entity_to_description_type("UNKNOWN", "generic")
        None
    """
    # Унифицированная таблица соответствий
    # Ключ: тип сущности (нормализованный), значение: тип описания
    entity_mapping = {
        # Персоны -> CHARACTER
        EntityType.PERSON.value: DescriptionType.CHARACTER.value,
        EntityType.PER.value: DescriptionType.CHARACTER.value,
        # Локации -> LOCATION
        EntityType.LOCATION.value: DescriptionType.LOCATION.value,
        EntityType.GPE.value: DescriptionType.LOCATION.value,
        EntityType.FAC.value: DescriptionType.LOCATION.value,
        # Организации -> OBJECT
        EntityType.ORGANIZATION.value: DescriptionType.OBJECT.value,
        # Разное -> OBJECT
        EntityType.MISC.value: DescriptionType.OBJECT.value,
        EntityType.OBJECT.value: DescriptionType.OBJECT.value,
    }

    # Нормализуем entity_type (приводим к верхнему регистру)
    normalized_type = entity_type.upper() if entity_type else None

    return entity_mapping.get(normalized_type)


def map_spacy_entity_to_description_type(entity_label: str) -> Optional[str]:
    """
    Преобразует тип сущности spaCy в тип описания.

    spaCy специфичные типы:
    - PERSON -> character
    - LOC, GPE, FAC -> location
    - ORG -> object

    Args:
        entity_label: Метка сущности от spaCy (например, ent.label_)

    Returns:
        Тип описания BookReader

    Example:
        >>> map_spacy_entity_to_description_type("GPE")
        'location'
    """
    return map_entity_to_description_type(entity_label, processor="spacy")


def map_natasha_entity_to_description_type(entity_type: str) -> Optional[str]:
    """
    Преобразует тип сущности Natasha в тип описания.

    Natasha использует константы:
    - PER -> character
    - LOC -> location
    - ORG -> object

    Args:
        entity_type: Тип сущности от Natasha (PER, LOC, ORG)

    Returns:
        Тип описания BookReader

    Example:
        >>> map_natasha_entity_to_description_type("PER")
        'character'
    """
    return map_entity_to_description_type(entity_type, processor="natasha")


def map_stanza_entity_to_description_type(entity_type: str) -> Optional[str]:
    """
    Преобразует тип сущности Stanza в тип описания.

    Stanza типы:
    - PER -> character
    - LOC -> location
    - ORG -> object
    - MISC -> object

    Args:
        entity_type: Тип сущности от Stanza

    Returns:
        Тип описания BookReader

    Example:
        >>> map_stanza_entity_to_description_type("LOC")
        'location'
    """
    return map_entity_to_description_type(entity_type, processor="stanza")


def determine_type_by_keywords(text: str) -> str:
    """
    Определяет тип описания на основе ключевых слов в тексте.

    Используется как fallback когда именованные сущности не обнаружены.

    Args:
        text: Текст описания

    Returns:
        Тип описания (по умолчанию OBJECT если не определено)

    Example:
        >>> determine_type_by_keywords("дом стоял на холме")
        'location'

        >>> determine_type_by_keywords("девушка была красива")
        'character'

        >>> determine_type_by_keywords("воздух был свежим")
        'atmosphere'
    """
    text_lower = text.lower()

    # Ключевые слова для локаций
    location_keywords = [
        "место",
        "дом",
        "здание",
        "город",
        "лес",
        "поле",
        "река",
        "море",
        "озеро",
        "гора",
        "холм",
        "замок",
        "дворец",
        "храм",
        "мост",
        "улица",
        "площадь",
        "комната",
        "зал",
        "сад",
        "парк",
    ]

    # Ключевые слова для персонажей
    character_keywords = [
        "человек",
        "лицо",
        "глаза",
        "волосы",
        "рука",
        "нога",
        "девушка",
        "мужчина",
        "ребёнок",
        "старик",
        "женщина",
        "герой",
        "героиня",
        "персонаж",
        "юноша",
        "парень",
    ]

    # Ключевые слова для атмосферы
    atmosphere_keywords = [
        "воздух",
        "атмосфера",
        "настроение",
        "чувство",
        "тишина",
        "звук",
        "шум",
        "запах",
        "аромат",
        "свет",
        "тень",
        "туман",
        "темнота",
        "яркость",
        "холод",
        "тепло",
    ]

    # Подсчитываем совпадения
    location_score = sum(1 for word in location_keywords if word in text_lower)
    character_score = sum(1 for word in character_keywords if word in text_lower)
    atmosphere_score = sum(1 for word in atmosphere_keywords if word in text_lower)

    # Определяем максимальный счет
    max_score = max(location_score, character_score, atmosphere_score)

    if max_score == 0:
        # Нет совпадений - возвращаем OBJECT по умолчанию
        return DescriptionType.OBJECT.value
    elif max_score == location_score:
        return DescriptionType.LOCATION.value
    elif max_score == character_score:
        return DescriptionType.CHARACTER.value
    else:
        return DescriptionType.ATMOSPHERE.value


def get_supported_entity_types(processor: str = "all") -> list:
    """
    Возвращает список поддерживаемых типов сущностей для указанного процессора.

    Args:
        processor: Название процессора ("spacy", "natasha", "stanza", "all")

    Returns:
        Список поддерживаемых типов сущностей

    Example:
        >>> get_supported_entity_types("spacy")
        ['PERSON', 'LOC', 'GPE', 'FAC', 'ORG']

        >>> get_supported_entity_types("natasha")
        ['PER', 'LOC', 'ORG']
    """
    spacy_types = [
        EntityType.PERSON.value,
        EntityType.LOCATION.value,
        EntityType.GPE.value,
        EntityType.FAC.value,
        EntityType.ORGANIZATION.value,
    ]

    natasha_types = [
        EntityType.PER.value,
        EntityType.LOCATION.value,
        EntityType.ORGANIZATION.value,
    ]

    stanza_types = [
        EntityType.PER.value,
        EntityType.LOCATION.value,
        EntityType.ORGANIZATION.value,
        EntityType.MISC.value,
    ]

    if processor == "spacy":
        return spacy_types
    elif processor == "natasha":
        return natasha_types
    elif processor == "stanza":
        return stanza_types
    elif processor == "all":
        # Возвращаем все уникальные типы
        return list(set(spacy_types + natasha_types + stanza_types))
    else:
        return []
