"""
Response schemas для NLP Testing endpoints.

Содержит Pydantic модели для:
- Тестирование NLP на главе книги
- Тестирование NLP на всей книге
- Результаты работы отдельных процессоров
- Статистика обработки

Version: Phase 1.3 Type Safety (2025-11-29)
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

# Reuse existing NLPAnalysisResult from descriptions.py
from .descriptions import NLPAnalysisResult


class ProcessorTestResult(BaseModel):
    """
    Результат тестирования одного NLP процессора.

    Используется в NLPTestBookResponse для показа результатов
    работы каждого процессора (spacy, natasha, stanza, gliner).

    Attributes:
        processor_name: Название процессора (spacy | natasha | stanza | gliner)
        success: Успешно ли завершилась обработка
        descriptions_found: Количество найденных описаний
        processing_time_seconds: Время обработки в секундах
        error_message: Сообщение об ошибке (если success=False)
    """

    processor_name: str = Field(
        description="NLP processor name: spacy | natasha | stanza | gliner",
        pattern="^(spacy|natasha|stanza|gliner|deeppavlov)$"
    )
    success: bool = Field(description="Whether processing was successful")
    descriptions_found: int = Field(
        ge=0,
        description="Number of descriptions found by this processor"
    )
    processing_time_seconds: float = Field(
        ge=0.0,
        description="Processing time in seconds"
    )
    error_message: Optional[str] = Field(
        None,
        description="Error message if processing failed"
    )


class NLPTestChapterResponse(BaseModel):
    """
    Результат NLP тестирования на одной главе.

    Используется в POST /api/v1/nlp/extract-descriptions.

    Тестирует извлечение описаний из предоставленного текста
    БЕЗ сохранения в базу данных (test mode).

    Полезно для:
    - Preview анализа перед загрузкой книги
    - Тестирования качества NLP
    - Демонстрации возможностей системы

    Attributes:
        chapter_info: Метаданные о главе (title, word_count, etc.)
        nlp_analysis: Полный NLP анализ с описаниями
        message: Сообщение о результате обработки
        test_mode: True (всегда для тестовых endpoints)
        processor_used: Какой NLP процессор был использован (опционально)
    """

    chapter_info: Dict[str, Any] = Field(
        description="Chapter metadata (title, word_count, preview_text, etc.)"
    )
    nlp_analysis: NLPAnalysisResult = Field(
        description="NLP analysis results with descriptions"
    )
    message: str = Field(
        default="NLP analysis completed successfully",
        description="Human-readable status message"
    )
    test_mode: bool = Field(
        default=True,
        description="Always true for test endpoints (not saved to DB)"
    )
    processor_used: Optional[str] = Field(
        None,
        description="Which NLP processor was used (spacy, natasha, stanza, gliner, ensemble)"
    )


class NLPTestBookResponse(BaseModel):
    """
    Результат NLP тестирования на всей книге.

    Используется в GET /api/v1/nlp/test-book-sample.

    Анализирует образец текста книги с помощью всех доступных
    NLP процессоров и сравнивает результаты.

    Полезно для:
    - Сравнения качества разных процессоров
    - Бенчмаркинга производительности
    - Выбора оптимального процессора для книги

    Attributes:
        book_info: Метаданные о книге (title, author, genre, etc.)
        total_chapters: Всего глав в книге (или в образце)
        total_descriptions: Всего найдено описаний (суммарно по всем процессорам)
        test_results: Результаты работы каждого процессора
        message: Сообщение о результате обработки
        test_mode: True (всегда для тестовых endpoints)
    """

    book_info: Dict[str, Any] = Field(
        description="Book metadata (title, author, genre, sample_text_preview, etc.)"
    )
    total_chapters: int = Field(
        ge=0,
        description="Total chapters in the book (or sample)"
    )
    total_descriptions: int = Field(
        ge=0,
        description="Total descriptions found across all processors"
    )
    test_results: List[ProcessorTestResult] = Field(
        default_factory=list,
        description="Test results for each NLP processor"
    )
    message: str = Field(
        default="Book NLP testing completed successfully",
        description="Human-readable status message"
    )
    test_mode: bool = Field(
        default=True,
        description="Always true for test endpoints (not saved to DB)"
    )


class NLPLibraryStatus(BaseModel):
    """
    Статус одной NLP библиотеки.

    Используется в GET /api/v1/nlp/test-libraries.

    Attributes:
        status: Статус библиотеки (ok | error | library_ok_model_missing | library_ok_data_missing)
        version: Версия библиотеки (опционально)
        model: Информация о модели (опционально)
        test: Результат теста в человекочитаемом виде
        error: Сообщение об ошибке (если status=error)
    """

    status: str = Field(
        description="Library status: ok | error | library_ok_model_missing | library_ok_data_missing"
    )
    version: Optional[str] = Field(
        None,
        description="Library version if available"
    )
    model: Optional[str] = Field(
        None,
        description="Model information (e.g., 'ru_core_news_lg loaded')"
    )
    test: str = Field(
        description="Human-readable test result"
    )
    error: Optional[str] = Field(
        None,
        description="Error message if status=error"
    )


class NLPLibrariesTestResponse(BaseModel):
    """
    Результат тестирования NLP библиотек.

    Используется в GET /api/v1/nlp/test-libraries.

    Проверяет доступность и работоспособность всех NLP библиотек:
    - spaCy (ru_core_news_lg)
    - NLTK (punkt tokenizer)
    - Stanza (ru model)
    - Natasha
    - pymorphy3
    - ebooklib (для парсинга EPUB)
    - lxml (для парсинга XML)

    Attributes:
        summary: Краткая сводка (working/total, status)
        libraries: Детальная информация по каждой библиотеке
        message: Сообщение о результате тестирования
    """

    summary: Dict[str, Any] = Field(
        description="Summary: {working: int, total: int, status: 'healthy' | 'partial'}"
    )
    libraries: Dict[str, NLPLibraryStatus] = Field(
        description="Detailed status for each library"
    )
    message: str = Field(
        description="Human-readable test summary"
    )


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "ProcessorTestResult",
    "NLPTestChapterResponse",
    "NLPTestBookResponse",
    "NLPLibraryStatus",
    "NLPLibrariesTestResponse",
]
