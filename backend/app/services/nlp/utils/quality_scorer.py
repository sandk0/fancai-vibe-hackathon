"""
Quality scoring utilities for NLP descriptions.

Extracted from scattered quality scoring logic across:
- enhanced_nlp_system.py (_calculate_quality_score)
- natasha_processor.py (_calculate_descriptive_score, _calculate_ner_confidence)
- stanza_processor.py (_calculate_morphological_descriptiveness, _calculate_dependency_confidence)

This module provides unified quality assessment functions.
"""

from typing import List, Dict, Any, Optional


def calculate_quality_score(descriptions: List[Dict[str, Any]]) -> float:
    """
    Вычисляет общую оценку качества извлеченных описаний.

    Факторы качества:
    1. Длина текста (оптимально ~200 символов)
    2. Уверенность извлечения
    3. Разнообразие слов

    Args:
        descriptions: Список описаний для оценки

    Returns:
        Оценка качества от 0.0 до 1.0

    Example:
        >>> descs = [
        ...     {
        ...         'content': 'Длинное описательное предложение с множеством слов',
        ...         'confidence_score': 0.8
        ...     }
        ... ]
        >>> score = calculate_quality_score(descs)
        >>> 0.0 <= score <= 1.0
        True
    """
    if not descriptions:
        return 0.0

    total_score = 0.0

    for desc in descriptions:
        content = desc.get("content", "")
        words = content.split()

        # Фактор 1: Оценка длины (оптимум ~200 символов)
        length_score = min(1.0, len(content) / 200)

        # Фактор 2: Уверенность извлечения
        confidence_score = desc.get("confidence_score", 0.5)

        # Фактор 3: Разнообразие слов (лексическое богатство)
        unique_words = len(set(words))
        total_words = max(1, len(words))
        word_variety = unique_words / total_words

        # Взвешенная оценка качества описания
        desc_quality = length_score * 0.3 + confidence_score * 0.5 + word_variety * 0.2

        total_score += desc_quality

    # Средняя оценка по всем описаниям
    average_quality = total_score / len(descriptions)

    return round(average_quality, 3)


def calculate_descriptive_score(
    text: str,
    adj_count: Optional[int] = None,
    adv_count: Optional[int] = None,
    verb_count: Optional[int] = None,
    total_tokens: Optional[int] = None,
) -> float:
    """
    Вычисляет описательную оценку текста на основе морфологии.

    Высокий процент прилагательных и наречий указывает на описательность.

    Args:
        text: Текст для оценки
        adj_count: Количество прилагательных (опционально)
        adv_count: Количество наречий (опционально)
        verb_count: Количество глаголов (опционально)
        total_tokens: Общее количество токенов (опционально)

    Returns:
        Описательная оценка от 0.0 до 1.0

    Example:
        >>> score = calculate_descriptive_score(
        ...     "Красивый большой дом",
        ...     adj_count=2,
        ...     adv_count=0,
        ...     verb_count=0,
        ...     total_tokens=3
        ... )
        >>> score > 0.5
        True
    """
    # Если параметры не переданы, используем простую эвристику по ключевым словам
    if adj_count is None or total_tokens is None:
        return calculate_descriptive_score_by_keywords(text)

    if total_tokens == 0:
        return 0.0

    score = 0.0

    # Базовая оценка: соотношение описательных слов к общему количеству
    adj_count = adj_count or 0
    adv_count = adv_count or 0
    verb_count = verb_count or 0

    descriptive_ratio = (adj_count + adv_count) / total_tokens
    score += descriptive_ratio * 0.8

    # Бонус за умеренное количество глаголов (1-3)
    # Слишком много глаголов = действие, а не описание
    if 1 <= verb_count <= 3:
        score += 0.2

    return min(1.0, round(score, 3))


def calculate_descriptive_score_by_keywords(text: str) -> float:
    """
    Вычисляет описательную оценку на основе ключевых слов.

    Упрощенный метод для случаев когда морфологический анализ недоступен.

    Args:
        text: Текст для оценки

    Returns:
        Описательная оценка от 0.0 до 1.0

    Example:
        >>> score = calculate_descriptive_score_by_keywords("Красивый старый дом")
        >>> score > 0
        True
    """
    text_lower = text.lower()

    # Описательные прилагательные
    descriptive_adjectives = [
        "красивый",
        "большой",
        "маленький",
        "старый",
        "новый",
        "высокий",
        "низкий",
        "тёмный",
        "светлый",
        "яркий",
        "мрачный",
        "величественный",
        "таинственный",
        "уютный",
        "просторный",
        "узкий",
        "широкий",
        "длинный",
        "короткий",
    ]

    # Описательные наречия
    descriptive_adverbs = [
        "красиво",
        "ярко",
        "тихо",
        "громко",
        "быстро",
        "медленно",
        "тепло",
        "холодно",
        "свежо",
        "мрачно",
        "светло",
    ]

    # Подсчитываем совпадения
    adj_matches = sum(1 for word in descriptive_adjectives if word in text_lower)
    adv_matches = sum(1 for word in descriptive_adverbs if word in text_lower)

    # Нормализуем по длине текста
    words = text_lower.split()
    total_words = max(1, len(words))

    descriptive_ratio = (adj_matches + adv_matches) / total_words

    return min(1.0, round(descriptive_ratio * 2, 3))  # *2 для усиления эффекта


def calculate_ner_confidence(
    entity_text: str,
    sentence_text: str,
    entity_position: Optional[float] = None,
    context_descriptive_words: int = 0,
) -> float:
    """
    Вычисляет уверенность для именованной сущности.

    Факторы:
    1. Длина сущности (длиннее = лучше)
    2. Позиция в предложении (не в самом начале/конце)
    3. Наличие описательных слов рядом

    Args:
        entity_text: Текст сущности
        sentence_text: Текст предложения
        entity_position: Относительная позиция в предложении (0-1, опционально)
        context_descriptive_words: Количество описательных слов рядом

    Returns:
        Уверенность от 0.0 до 1.0

    Example:
        >>> conf = calculate_ner_confidence(
        ...     "Москва",
        ...     "Красивая Москва встретила путников",
        ...     entity_position=0.3,
        ...     context_descriptive_words=1
        ... )
        >>> conf > 0.5
        True
    """
    base_confidence = 0.6

    # Бонус за длину сущности
    if len(entity_text) > 3:
        base_confidence += 0.1

    # Бонус за позицию в предложении (не в самом начале/конце)
    if entity_position is not None:
        if 0.1 <= entity_position <= 0.9:
            base_confidence += 0.1

    # Бонус за описательные слова в контексте
    descriptor_bonus = min(0.2, context_descriptive_words * 0.05)
    base_confidence += descriptor_bonus

    return min(1.0, round(base_confidence, 3))


def calculate_dependency_confidence(
    dependency_type: str,
    head_pos: Optional[str] = None,
    dependent_pos: Optional[str] = None,
    sentence_length: int = 0,
) -> float:
    """
    Вычисляет уверенность для синтаксической зависимости.

    Args:
        dependency_type: Тип зависимости (amod, nmod, acl, appos)
        head_pos: Часть речи главного слова (опционально)
        dependent_pos: Часть речи зависимого слова (опционально)
        sentence_length: Длина предложения в словах

    Returns:
        Уверенность от 0.0 до 1.0

    Example:
        >>> conf = calculate_dependency_confidence(
        ...     "amod",
        ...     head_pos="NOUN",
        ...     dependent_pos="ADJ",
        ...     sentence_length=10
        ... )
        >>> conf > 0.5
        True
    """
    base_confidence = 0.6

    # Бонус за тип зависимости
    dep_bonuses = {
        "amod": 0.2,  # прилагательное-определение (очень описательно)
        "nmod": 0.15,  # именное определение
        "acl": 0.1,  # придаточное определительное
        "appos": 0.15,  # приложение
    }
    base_confidence += dep_bonuses.get(dependency_type, 0)

    # Бонус за описательные части речи
    if head_pos == "NOUN" and dependent_pos in ["ADJ", "VERB"]:
        base_confidence += 0.1

    # Бонус за длину контекста
    if sentence_length >= 8:
        base_confidence += 0.05

    return min(1.0, round(base_confidence, 3))


def calculate_morphological_descriptiveness(
    adj_count: int, adv_count: int, participle_count: int, total_words: int
) -> float:
    """
    Вычисляет описательность на основе морфологических признаков.

    Используется для Stanza процессора.

    Args:
        adj_count: Количество прилагательных
        adv_count: Количество наречий
        participle_count: Количество причастий
        total_words: Общее количество слов

    Returns:
        Оценка описательности от 0.0 до 1.0

    Example:
        >>> score = calculate_morphological_descriptiveness(
        ...     adj_count=3,
        ...     adv_count=1,
        ...     participle_count=1,
        ...     total_words=10
        ... )
        >>> score > 0.3
        True
    """
    if total_words == 0:
        return 0.0

    # Высокая доля прилагательных, наречий и причастий = описательность
    descriptive_ratio = (adj_count + adv_count + participle_count) / total_words

    # Бонус за разнообразие описательных слов
    # Предполагаем что разные типы описательных слов дают лучшее описание
    descriptive_variety = 0.0
    if adj_count > 0:
        descriptive_variety += 0.1
    if adv_count > 0:
        descriptive_variety += 0.1
    if participle_count > 0:
        descriptive_variety += 0.1

    total_score = descriptive_ratio * 0.8 + descriptive_variety

    return min(1.0, round(total_score, 3))


def assess_description_quality(description: Dict[str, Any]) -> Dict[str, float]:
    """
    Комплексная оценка качества одного описания.

    Возвращает детальный breakdown по различным факторам качества.

    Args:
        description: Описание для оценки

    Returns:
        Словарь с различными оценками качества

    Example:
        >>> desc = {
        ...     'content': 'Красивый старый замок стоял на холме',
        ...     'confidence_score': 0.8,
        ...     'word_count': 6
        ... }
        >>> quality = assess_description_quality(desc)
        >>> 'overall_quality' in quality
        True
    """
    content = description.get("content", "")
    words = content.split()

    # Различные факторы качества
    length_score = min(1.0, len(content) / 200)
    confidence = description.get("confidence_score", 0.5)
    word_variety = len(set(words)) / max(1, len(words))
    word_count = description.get("word_count", len(words))
    word_count_score = 1.0 if 10 <= word_count <= 50 else 0.5

    # Общая оценка
    overall_quality = (
        length_score * 0.25
        + confidence * 0.35
        + word_variety * 0.2
        + word_count_score * 0.2
    )

    return {
        "overall_quality": round(overall_quality, 3),
        "length_score": round(length_score, 3),
        "confidence_score": confidence,
        "word_variety": round(word_variety, 3),
        "word_count_score": word_count_score,
    }
