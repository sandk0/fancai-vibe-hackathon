"""
Адаптеры для интеграции внешних парсеров в Multi-NLP систему.

Этот модуль содержит адаптеры, которые конвертируют результаты
внешних парсеров в формат ProcessingResult для Multi-NLP Manager.
"""

from .advanced_parser_adapter import AdvancedParserAdapter

__all__ = ["AdvancedParserAdapter"]
