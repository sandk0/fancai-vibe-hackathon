"""
Description filtering and prioritization utilities.

Extracted from duplicated filtering logic across:
- natasha_processor.py (_filter_and_prioritize_descriptions)
- stanza_processor.py (_filter_and_prioritize_descriptions)
- nlp_processor.py (_filter_and_prioritize, _calculate_priority_score)

This module provides shared filtering, deduplication, and prioritization logic.
"""

from typing import List, Dict, Any, Optional
from ....models.description import DescriptionType


# Default configuration values
DEFAULT_MIN_DESCRIPTION_LENGTH = 50
DEFAULT_MAX_DESCRIPTION_LENGTH = 1000
DEFAULT_MIN_WORD_COUNT = 10
DEFAULT_CONFIDENCE_THRESHOLD = 0.3


def filter_and_prioritize_descriptions(
    descriptions: List[Dict[str, Any]],
    min_description_length: int = DEFAULT_MIN_DESCRIPTION_LENGTH,
    max_description_length: int = DEFAULT_MAX_DESCRIPTION_LENGTH,
    min_word_count: int = DEFAULT_MIN_WORD_COUNT,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    deduplicate: bool = True,
    dedup_window_size: int = 100,
) -> List[Dict[str, Any]]:
    """
    Фильтрует и приоритизирует описания по качественным критериям.

    Args:
        descriptions: Список описаний для фильтрации
        min_description_length: Минимальная длина описания в символах
        max_description_length: Максимальная длина описания в символах
        min_word_count: Минимальное количество слов
        confidence_threshold: Минимальный порог уверенности (0-1)
        deduplicate: Удалять дубликаты (по умолчанию True)
        dedup_window_size: Размер окна для определения дубликата

    Returns:
        Отфильтрованный и отсортированный список описаний

    Example:
        >>> descs = [
        ...     {'content': 'Короткое', 'confidence_score': 0.9, 'word_count': 1},
        ...     {'content': 'Достаточно длинное описание для фильтра',
        ...      'confidence_score': 0.8, 'word_count': 5, 'type': 'location'},
        ... ]
        >>> filtered = filter_and_prioritize_descriptions(descs)
        >>> len(filtered)
        1
    """
    # Шаг 1: Дедупликация (если включена)
    if deduplicate:
        descriptions = deduplicate_descriptions(descriptions, dedup_window_size)

    # Шаг 2: Фильтрация по качественным критериям
    filtered = []
    for desc in descriptions:
        content_length = len(desc.get("content", ""))
        word_count = desc.get("word_count", len(desc.get("content", "").split()))
        confidence = desc.get("confidence_score", 0.0)

        # Проверяем все критерии качества
        if (
            min_description_length <= content_length <= max_description_length
            and word_count >= min_word_count
            and confidence >= confidence_threshold
        ):
            # Вычисляем приоритет если он еще не установлен
            if "priority_score" not in desc:
                desc["priority_score"] = calculate_priority_score(
                    desc.get("type"), confidence, content_length, word_count
                )

            filtered.append(desc)

    # Шаг 3: Сортировка по приоритету (от высокого к низкому)
    filtered.sort(key=lambda x: x.get("priority_score", 0), reverse=True)

    return filtered


def deduplicate_descriptions(
    descriptions: List[Dict[str, Any]], window_size: int = 100
) -> List[Dict[str, Any]]:
    """
    Удаляет дублирующиеся описания на основе содержимого.

    Args:
        descriptions: Список описаний
        window_size: Размер окна для сравнения (количество символов)

    Returns:
        Список уникальных описаний

    Example:
        >>> descs = [
        ...     {'content': 'Описание локации с деталями'},
        ...     {'content': 'Описание локации с деталями'},  # дубликат
        ...     {'content': 'Другое описание'},
        ... ]
        >>> unique = deduplicate_descriptions(descs)
        >>> len(unique)
        2
    """
    unique_descriptions = []
    seen_content = set()

    for desc in descriptions:
        content = desc.get("content", "")

        # Создаем ключ для дедупликации (первые N символов)
        content_key = content[:window_size].strip().lower()

        if content_key not in seen_content:
            seen_content.add(content_key)
            unique_descriptions.append(desc)

    return unique_descriptions


def calculate_priority_score(
    desc_type: Optional[str],
    confidence: float,
    text_length: int,
    word_count: int = None,
) -> float:
    """
    Рассчитывает приоритетный счет описания.

    Факторы приоритета:
    1. Тип описания (локации важнее действий)
    2. Уверенность извлечения
    3. Оптимальная длина (50-400 символов)
    4. Количество слов (опционально)

    Args:
        desc_type: Тип описания (location, character, atmosphere, etc.)
        confidence: Уверенность извлечения (0-1)
        text_length: Длина текста в символах
        word_count: Количество слов (опционально)

    Returns:
        Приоритетный счет (обычно 0-100)

    Example:
        >>> score = calculate_priority_score('location', 0.8, 200, 30)
        >>> score > 80
        True
    """
    # Базовые приоритеты по типам описаний
    type_priorities = {
        DescriptionType.LOCATION.value: 75,
        DescriptionType.CHARACTER.value: 60,
        DescriptionType.ATMOSPHERE.value: 45,
        DescriptionType.OBJECT.value: 40,
        DescriptionType.ACTION.value: 30,
    }

    # Базовый приоритет по типу
    base_priority = type_priorities.get(desc_type, 30)

    # Бонус за уверенность (до 20 баллов)
    confidence_bonus = confidence * 20

    # Бонус за оптимальную длину (до 10 баллов)
    length_bonus = 0
    if 50 <= text_length <= 400:
        # Оптимальная длина - полный бонус
        length_bonus = 10
    elif text_length < 50:
        # Слишком короткое - пропорциональный штраф
        length_bonus = max(0, (text_length - 20) / 5)
    else:
        # Слишком длинное - пропорциональный штраф
        length_bonus = max(0, 10 - (text_length - 400) / 100)

    # Бонус за количество слов (опционально, до 5 баллов)
    word_bonus = 0
    if word_count:
        if 10 <= word_count <= 50:
            word_bonus = 5
        elif word_count < 10:
            word_bonus = word_count / 2
        else:
            word_bonus = max(0, 5 - (word_count - 50) / 20)

    # Итоговый счет
    total_score = base_priority + confidence_bonus + length_bonus + word_bonus

    return round(total_score, 2)


def apply_literary_boost(
    descriptions: List[Dict[str, Any]], boost_factor: float = 1.3
) -> List[Dict[str, Any]]:
    """
    Применяет литературный буст к приоритетам описаний.

    Используется для усиления приоритета описаний из художественной литературы,
    которые обычно более качественные.

    Args:
        descriptions: Список описаний
        boost_factor: Множитель для приоритета (по умолчанию 1.3)

    Returns:
        Описания с усиленным приоритетом

    Example:
        >>> descs = [{'priority_score': 50.0}]
        >>> boosted = apply_literary_boost(descs, boost_factor=1.5)
        >>> boosted[0]['priority_score']
        75.0
    """
    for desc in descriptions:
        if "priority_score" in desc:
            desc["priority_score"] *= boost_factor
            desc["priority_score"] = round(desc["priority_score"], 2)

    return descriptions


def filter_by_quality_threshold(
    descriptions: List[Dict[str, Any]], quality_threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Фильтрует описания по порогу качества.

    Args:
        descriptions: Список описаний
        quality_threshold: Минимальное качество (0-1)

    Returns:
        Описания выше порога качества
    """
    return [
        desc
        for desc in descriptions
        if desc.get("confidence_score", 0) >= quality_threshold
    ]
