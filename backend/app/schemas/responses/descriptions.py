"""
Response schemas для Description analysis endpoints.

Содержит Pydantic модели для:
- NLP анализ глав книги
- Описания в контексте главы
- Превью анализа главы
- Статистика по типам описаний

Version: Phase 1.2 Type Safety (2025-11-29)
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from uuid import UUID

# Import existing DescriptionResponse for reuse
from . import DescriptionResponse


class ChapterMinimalInfo(BaseModel):
    """
    Минимальная информация о главе для описаний.

    Используется в ChapterDescriptionsResponse.

    Attributes:
        id: UUID главы
        number: Номер главы
        title: Название главы
        word_count: Количество слов в главе
    """

    id: UUID
    number: int = Field(ge=1, description="Chapter number (1-indexed)")
    title: str = Field(description="Chapter title")
    word_count: int = Field(ge=0, description="Word count in chapter")


class NLPAnalysisResult(BaseModel):
    """
    Результаты NLP анализа текста.

    Используется в ChapterDescriptionsResponse и ChapterAnalysisResponse.

    Содержит:
    - Общее количество найденных описаний
    - Распределение по типам (LOCATION, CHARACTER, ATMOSPHERE, etc.)
    - Список извлеченных описаний с метаданными
    - Время обработки (опционально)

    Attributes:
        total_descriptions: Всего найдено описаний
        by_type: Количество по типам описаний
        descriptions: Список описаний с полной информацией
        processing_time_seconds: Время обработки NLP (опционально)
    """

    total_descriptions: int = Field(ge=0, description="Total descriptions found")
    by_type: Dict[str, int] = Field(
        default_factory=dict,
        description="Counts by DescriptionType (LOCATION, CHARACTER, ATMOSPHERE, etc.)"
    )
    descriptions: List[DescriptionResponse] = Field(
        default_factory=list,
        description="List of extracted descriptions with metadata"
    )
    processing_time_seconds: Optional[float] = Field(
        None,
        ge=0.0,
        description="NLP processing time in seconds (if available)"
    )


class ChapterDescriptionsResponse(BaseModel):
    """
    Response для описаний в главе книги.

    Используется в GET /api/v1/descriptions/{book_id}/chapters/{chapter_number}/descriptions.

    Включает:
    - Минимальную информацию о главе
    - Полный NLP анализ с описаниями
    - Сообщение об успешном выполнении

    Attributes:
        chapter_info: Информация о главе
        nlp_analysis: NLP анализ с описаниями
        message: Сообщение о результате
    """

    chapter_info: ChapterMinimalInfo
    nlp_analysis: NLPAnalysisResult
    message: str = Field(default="Descriptions retrieved successfully")


class ChapterAnalysisPreview(BaseModel):
    """
    Превью главы для анализа (без сохранения в БД).

    Используется в ChapterAnalysisResponse для preview режима.

    Attributes:
        chapter_number: Номер главы
        title: Название главы
        word_count: Количество слов
        preview_text: Первые 200 символов текста
    """

    chapter_number: int = Field(ge=1, description="Chapter number (1-indexed)")
    title: str = Field(description="Chapter title")
    word_count: int = Field(ge=0, description="Word count in chapter")
    preview_text: str = Field(
        max_length=500,
        description="First 200 chars of content (preview)"
    )


class ChapterAnalysisResponse(BaseModel):
    """
    Response для NLP анализа главы (preview mode).

    Используется в POST /api/v1/descriptions/analyze-chapter.

    Анализирует главу БЕЗ сохранения в базу данных.
    Полезно для:
    - Preview анализа перед загрузкой книги
    - Тестирования качества NLP
    - Демонстрации возможностей системы

    Attributes:
        chapter_info: Превью информации о главе
        nlp_analysis: Результаты NLP анализа
        message: Сообщение о результате
        test_mode: True если анализ не был сохранен в БД
    """

    chapter_info: ChapterAnalysisPreview
    nlp_analysis: NLPAnalysisResult
    message: str = Field(default="Chapter analyzed successfully")
    test_mode: bool = Field(
        default=False,
        description="True if analysis was not saved to database"
    )


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "ChapterMinimalInfo",
    "NLPAnalysisResult",
    "ChapterDescriptionsResponse",
    "ChapterAnalysisPreview",
    "ChapterAnalysisResponse",
]
