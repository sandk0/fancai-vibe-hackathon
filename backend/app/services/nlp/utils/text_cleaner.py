"""
Text cleaning utilities for NLP processors.

Extracted from duplicated _clean_text() methods across:
- enhanced_nlp_system.py (EnhancedNLPProcessor._clean_text)
- nlp_processor.py (BaseNLPProcessor._clean_text)
- natasha_processor.py (uses parent's _clean_text)
- stanza_processor.py (uses parent's _clean_text)

This module provides a single, shared implementation.
"""

import re


def clean_text(text: str, preserve_newlines: bool = False) -> str:
    """
    Очищает текст от лишних символов для NLP обработки.

    Args:
        text: Исходный текст для очистки
        preserve_newlines: Сохранять переводы строк (по умолчанию False)

    Returns:
        Очищенный текст

    Example:
        >>> clean_text("Привет,   мир!  \n\n  Как дела?")
        'Привет, мир! Как дела?'

        >>> clean_text("Текст   с\n\nпереносами", preserve_newlines=True)
        'Текст с\nпереносами'
    """
    if not text:
        return ""

    # Удаляем лишние пробелы и переносы
    if preserve_newlines:
        # Заменяем множественные пробелы на одиночные, но сохраняем \n
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n+", "\n", text)
    else:
        # Заменяем все whitespace на одиночные пробелы
        text = re.sub(r"\s+", " ", text)

    # Удаляем специальные символы, но оставляем:
    # - кириллицу (\w включает кириллицу)
    # - латиницу (\w)
    # - цифры (\w)
    # - пробелы (\s)
    # - знаки препинания (\.\,\!\?\;\:\-\—)
    # - кавычки (\«\»\"\')
    # - скобки (\(\)\[\])
    text = re.sub(r"[^\w\s\.\,\!\?\;\:\-\—\«\»\"\'\(\)\[\]]", "", text)

    return text.strip()


def remove_metadata_markers(text: str) -> str:
    """
    Удаляет маркеры метаданных из текста (например, HTML теги, XML разметку).

    Args:
        text: Текст с возможными маркерами метаданных

    Returns:
        Текст без маркеров

    Example:
        >>> remove_metadata_markers("<p>Текст</p>")
        'Текст'
    """
    # Удаляем HTML/XML теги
    text = re.sub(r"<[^>]+>", "", text)

    # Удаляем markdown заголовки
    text = re.sub(r"^#+\s+", "", text, flags=re.MULTILINE)

    return text.strip()


def normalize_whitespace(text: str) -> str:
    """
    Нормализует пробельные символы в тексте.

    Args:
        text: Текст для нормализации

    Returns:
        Нормализованный текст
    """
    # Заменяем табуляции на пробелы
    text = text.replace("\t", " ")

    # Заменяем множественные пробелы на одиночные
    text = re.sub(r" +", " ", text)

    # Удаляем пробелы в начале/конце строк
    text = re.sub(r"^ +| +$", "", text, flags=re.MULTILINE)

    # Удаляем множественные переводы строк (оставляем максимум 2)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()
