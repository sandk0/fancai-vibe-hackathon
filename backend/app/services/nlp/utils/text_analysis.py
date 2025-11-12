"""
Text Analysis Utilities for Multi-NLP System.

Provides functions to analyze text content for:
- Person name detection
- Location name detection
- Text complexity estimation
- Entity pattern matching

Extracted from duplicated analysis logic in multi_nlp_manager.py
"""

from typing import List, Set
import re


# Common Russian first names (male and female)
RUSSIAN_FIRST_NAMES: Set[str] = {
    # Male names
    "александр",
    "дмитрий",
    "максим",
    "сергей",
    "андрей",
    "алексей",
    "артём",
    "артем",
    "илья",
    "кирилл",
    "михаил",
    "иван",
    "егор",
    "роман",
    "владимир",
    "денис",
    "евгений",
    "николай",
    "павел",
    "пётр",
    "петр",
    "фёдор",
    "федор",
    "борис",
    "виктор",
    "геннадий",
    "григорий",
    "игорь",
    "константин",
    "леонид",
    "олег",
    "степан",
    "тимофей",
    "юрий",
    "ярослав",
    "антон",
    "вадим",
    "валентин",
    "валерий",
    "василий",
    "виталий",
    "владислав",
    "вячеслав",
    # Female names
    "анна",
    "мария",
    "елена",
    "ольга",
    "екатерина",
    "наталья",
    "ирина",
    "татьяна",
    "юлия",
    "светлана",
    "людмила",
    "галина",
    "надежда",
    "валентина",
    "нина",
    "александра",
    "дарья",
    "анастасия",
    "вера",
    "любовь",
    "инна",
    "лариса",
    "марина",
    "тамара",
    "зоя",
    "раиса",
    "маргарита",
    "алла",
    "вероника",
    "виктория",
    "диана",
    "евгения",
    "жанна",
    "зинаида",
    "кристина",
    "лидия",
    "майя",
    "оксана",
    "полина",
    "регина",
    "римма",
    "софья",
    "софия",
    "ульяна",
    "эмма",
}

# Common Russian surnames patterns (will be detected by regex)
SURNAME_PATTERNS = [
    r"\b[А-Я][а-я]+(?:ов|ев|ин|ын|ич|ко|ук|юк|ски|цки|ова|ева|ина|ына)\b",
]

# Common location keywords
LOCATION_KEYWORDS: Set[str] = {
    # Settlements
    "город",
    "деревня",
    "село",
    "посёлок",
    "поселок",
    "станица",
    "столица",
    "хутор",
    "местечко",
    "городок",
    "слобода",
    # Administrative
    "область",
    "район",
    "губерния",
    "уезд",
    "волость",
    "край",
    "республика",
    "округ",
    "провинция",
    # Streets and places
    "улица",
    "площадь",
    "проспект",
    "переулок",
    "бульвар",
    "аллея",
    "набережная",
    "тракт",
    "шоссе",
    "дорога",
    # Buildings
    "дом",
    "здание",
    "замок",
    "дворец",
    "башня",
    "крепость",
    "монастырь",
    "церковь",
    "храм",
    "собор",
    "часовня",
    "усадьба",
    "особняк",
    "хижина",
    "изба",
    "терем",
    "палаты",
    "казарма",
    "гостиница",
    "трактир",
    # Natural features
    "лес",
    "река",
    "озеро",
    "море",
    "океан",
    "гора",
    "холм",
    "поле",
    "долина",
    "степь",
    "луг",
    "пустыня",
    "болото",
    "берег",
    "побережье",
    "остров",
    "полуостров",
    "залив",
    "бухта",
    "мыс",
    "пещера",
    "ущелье",
    "овраг",
    "канал",
    "пруд",
    "ручей",
    "источник",
    "родник",
    "водопад",
    # Directions and locations
    "север",
    "юг",
    "восток",
    "запад",
    "центр",
    "окраина",
    "пригород",
    "предместье",
    "околица",
}


def contains_person_names(text: str) -> bool:
    """
    Проверяет, содержит ли текст имена людей.

    Uses both dictionary lookup for common Russian names and regex patterns
    for surnames.

    Args:
        text: Текст для анализа

    Returns:
        True если найдены имена

    Example:
        >>> contains_person_names("Александр вошел в комнату")
        True
        >>> contains_person_names("В комнате было темно")
        False
    """
    if not text:
        return False

    text_lower = text.lower()
    words = text_lower.split()

    # Check for first names
    if any(word in RUSSIAN_FIRST_NAMES for word in words):
        return True

    # Check for surname patterns
    for pattern in SURNAME_PATTERNS:
        if re.search(pattern, text):
            return True

    return False


def contains_location_names(text: str) -> bool:
    """
    Проверяет, содержит ли текст упоминания локаций.

    Args:
        text: Текст для анализа

    Returns:
        True если найдены локации

    Example:
        >>> contains_location_names("Старый город был красив")
        True
        >>> contains_location_names("Он был высоким")
        False
    """
    if not text:
        return False

    text_lower = text.lower()

    return any(keyword in text_lower for keyword in LOCATION_KEYWORDS)


def estimate_text_complexity(text: str) -> float:
    """
    Оценивает сложность текста (0.0-1.0).

    Factors:
    - Average word length
    - Sentence count
    - Vocabulary diversity
    - Punctuation density

    Args:
        text: Текст для анализа

    Returns:
        Complexity score (0.0-1.0)

    Example:
        >>> estimate_text_complexity("Он шел.")
        0.3  # Simple
        >>> estimate_text_complexity("Величественный замок возвышался над долиной.")
        0.7  # Complex
    """
    if not text:
        return 0.0

    words = text.split()
    num_words = len(words)

    if num_words == 0:
        return 0.0

    # Average word length
    avg_word_len = sum(len(w) for w in words) / num_words
    word_len_score = min(avg_word_len / 10, 1.0)

    # Vocabulary diversity (unique words / total words)
    unique_words = len(set(w.lower() for w in words))
    diversity = unique_words / num_words

    # Sentence count (approximate)
    sentence_markers = text.count(".") + text.count("!") + text.count("?")
    sentence_density = sentence_markers / max(num_words, 1)

    # Combine metrics
    complexity = (
        word_len_score * 0.4 + diversity * 0.4 + min(sentence_density * 10, 1.0) * 0.2
    )

    return min(complexity, 1.0)


def extract_capitalized_words(text: str) -> List[str]:
    """
    Извлекает слова с заглавной буквы (потенциальные имена).

    Excludes first word of sentence and common acronyms.

    Args:
        text: Текст для анализа

    Returns:
        Список слов с заглавной буквы

    Example:
        >>> extract_capitalized_words("Александр и Мария гуляли в парке")
        ['Мария']
        >>> extract_capitalized_words("Вчера встретил Ивана")
        ['Ивана']
    """
    if not text:
        return []

    words = text.split()

    capitalized = []
    for i, word in enumerate(words):
        # Skip first word (sentence start)
        if i == 0:
            continue

        # Check if word starts with capital letter (Cyrillic)
        if not word:
            continue

        # Remove punctuation for checking
        clean_word = re.sub(r"[^\w]", "", word)
        if not clean_word:
            continue

        # Check if starts with uppercase and rest is lowercase
        # Works for both Latin and Cyrillic
        if clean_word[0].isupper() and (
            len(clean_word) == 1 or clean_word[1:].islower()
        ):
            capitalized.append(clean_word)

    return capitalized


def count_descriptive_words(text: str) -> int:
    """
    Подсчитывает количество описательных слов в тексте.

    Descriptive words include adjectives and adverbs based on common patterns.
    This is a simplified heuristic-based approach.

    Args:
        text: Текст для анализа

    Returns:
        Количество описательных слов

    Example:
        >>> count_descriptive_words("Красивый старый дом стоял тихо")
        3  # красивый, старый, тихо
    """
    if not text:
        return 0

    text_lower = text.lower()

    # Common adjective endings
    adj_patterns = [
        r"\b\w+ый\b",  # красивый, старый
        r"\b\w+ая\b",  # красивая, старая
        r"\b\w+ое\b",  # красивое, старое
        r"\b\w+ий\b",  # синий, древний
        r"\b\w+яя\b",  # синяя, древняя
        r"\b\w+ее\b",  # синее, древнее
    ]

    # Common adverb endings
    adv_patterns = [
        r"\b\w+о\b",  # тихо, красиво (careful - can be many false positives)
        r"\b\w+е\b",  # тише, красивее
    ]

    count = 0

    # Count adjectives
    for pattern in adj_patterns:
        matches = re.findall(pattern, text_lower)
        # Filter out very short words (likely false positives)
        count += len([m for m in matches if len(m) >= 5])

    # Count adverbs (with stricter length requirement)
    for pattern in adv_patterns:
        matches = re.findall(pattern, text_lower)
        # Only count longer words to reduce false positives
        count += len([m for m in matches if len(m) >= 6])

    return count


def is_dialogue_text(text: str) -> bool:
    """
    Определяет, является ли текст диалогом.

    Dialogues typically contain quotation marks and dialogue markers.

    Args:
        text: Текст для анализа

    Returns:
        True если текст содержит диалог

    Example:
        >>> is_dialogue_text('"Привет!" - сказал он.')
        True
        >>> is_dialogue_text('Он шёл по дороге.')
        False
    """
    if not text:
        return False

    # Quotation marks (various styles)
    has_quotes = '"' in text or "«" in text or "»" in text or '"' in text or '"' in text

    # Dialogue markers
    dialogue_markers = [
        "- ",
        "– ",
        "— ",  # dashes
        "сказал",
        "ответил",
        "спросил",
        "воскликнул",
        "произнёс",
        "промолвил",
        "проговорил",
    ]

    has_markers = any(marker in text.lower() for marker in dialogue_markers)

    # High confidence if both quotes and markers present
    if has_quotes and has_markers:
        return True

    # Medium confidence if just quotes (but substantial amount)
    if has_quotes and text.count('"') >= 2:
        return True

    return False


def extract_sentence_subjects(text: str) -> List[str]:
    """
    Извлекает потенциальные подлежащие из предложений.

    This is a simple heuristic-based extraction. For production,
    use proper dependency parsing from Stanza or SpaCy.

    Args:
        text: Текст для анализа

    Returns:
        Список потенциальных подлежащих

    Example:
        >>> extract_sentence_subjects("Александр шёл по дороге. Мария читала книгу.")
        ['Александр', 'Мария']
    """
    if not text:
        return []

    subjects = []

    # Split into sentences
    sentences = re.split(r"[.!?]", text)

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Get first capitalized word (simple heuristic)
        words = sentence.split()
        if words:
            first_word = re.sub(r"[^\w]", "", words[0])
            if first_word and first_word[0].isupper():
                subjects.append(first_word)

    return subjects
